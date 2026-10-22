import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { notify } from "../../utils/notify.jsx";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { logAudit } from "../../services/auditService.js";
import { BloomsVisualizationPanel } from "../../components/BloomsVisualization";
import { QuizSuggestions } from "../../components/QuizSuggestions";
import { analyzeGADQuestion } from "../../services/gadAnalysisService.js";
import { Skeleton, SkeletonTableRow } from "../../components/ui/Skeleton.jsx";
import { ExamStatusTimeline } from "../../components/quiz/ExamStatusTimeline.jsx";
import { ExamRevisionHistory } from "../../components/quiz/ExamRevisionHistory.jsx";
import { useConfirm } from "../../components/ui/ConfirmModal.jsx";
import {
  HEAD_STATUSES,
  cleanQuizTitle,
  getProfileName,
  updateSubmissionAsHead,
  formatQuestionComments,
  exportSubmissionTosPdf,
  exportSubmissionQuizPaper,
} from "../../services/facultyHeadService.js";
import { formatReviewerLabel } from "../../utils/reviewerLabel.js";

export const FacultyHeadApprovalDetail = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { submissionId } = useParams();
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  // "approve" | "revision" while that action is running
  const [pendingAction, setPendingAction] = useState(null);
  const actionLoading = pendingAction !== null;
  const [exporting, setExporting] = useState(null);
  const [questionMetaById, setQuestionMetaById] = useState({});
  const [questionMetaByText, setQuestionMetaByText] = useState({});
  const [questionMetaByIndex, setQuestionMetaByIndex] = useState([]);
  const [revisions, setRevisions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  // Department Head comments: overall + per question (keyed by questionId)
  const [feedbackInput, setFeedbackInput] = useState("");
  const [headQuestionFeedback, setHeadQuestionFeedback] = useState({});

  const normalizeQuestionText = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  useEffect(() => {
    loadSubmission();
  }, [submissionId]);

  const loadSubmission = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("quiz_analysis_submissions")
        .select("*, quizzes(title, description, duration, parent_quiz_id)")
        .eq("id", submissionId)
        .single();

      if (error) throw error;

      if (data) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name, email, username, is_admin")
          .eq("id", data.instructor_id)
          .maybeSingle();

        // Who reviewed / forwarded this submission (peer reviewer or Senior Faculty)
        const reviewerId = data.reviewed_by || data.assigned_reviewer_id;
        let reviewer = null;
        if (reviewerId) {
          const { data: reviewerProfile } = await supabase
            .from("profiles")
            .select("first_name, last_name, email, username, is_admin")
            .eq("id", reviewerId)
            .maybeSingle();
          reviewer = reviewerProfile || null;
        }

        // Fetch section data via quiz_sections junction table
        let sectionData = null;
        if (data.quiz_id) {
          const { data: qs } = await supabase
            .from("quiz_sections")
            .select("section_id, sections(name, subject_code, subjects(code, name))")
            .eq("quiz_id", data.quiz_id)
            .limit(1)
            .maybeSingle();
          sectionData = qs?.sections || null;
        }

        // Fetch questions with options
        if (data.quiz_id) {
          const { data: questionRows } = await supabase
            .from("questions")
            .select("id, text, type, options, correct_answer")
            .eq("quiz_id", data.quiz_id)
            .order("created_at", { ascending: true });

          const metaMapById = (questionRows || []).reduce((acc, q) => {
            acc[String(q.id)] = {
              type: q.type,
              text: q.text,
              options: q.options || [],
              correctAnswer: q.correct_answer,
            };
            return acc;
          }, {});

          const metaMapByText = (questionRows || []).reduce((acc, q) => {
            const key = normalizeQuestionText(q.text);
            if (!key) return acc;
            if (!acc[key]) {
              acc[key] = {
                type: q.type,
                text: q.text,
                options: q.options || [],
                correctAnswer: q.correct_answer,
              };
            }
            return acc;
          }, {});

          setQuestionMetaById(metaMapById);
          setQuestionMetaByText(metaMapByText);
          setQuestionMetaByIndex(
            (questionRows || []).map((q) => ({
              type: q.type,
              text: q.text,
              options: q.options || [],
              correctAnswer: q.correct_answer,
            })),
          );
        }

        // Fetch revision history chain for this quiz: all submissions for
        // quizzes that share this chain's rootId, newest first.
        const rootId = data.quizzes?.parent_quiz_id || data.quiz_id;
        let allRevisions = [];
        if (rootId) {
          const { data: chainQuizzes } = await supabase
            .from("quizzes")
            .select("id")
            .or(`id.eq.${rootId},parent_quiz_id.eq.${rootId}`);

          const chainQuizIds = (chainQuizzes || []).map((q) => q.id);
          if (chainQuizIds.length > 0) {
            const { data: chainSubs } = await supabase
              .from("quiz_analysis_submissions")
              .select("*, quizzes(title, parent_quiz_id)")
              .in("quiz_id", chainQuizIds)
              .order("created_at", { ascending: false });
            const chainReviewerIds = [
              ...new Set(
                (chainSubs || [])
                  .map((s) => s.reviewed_by || s.assigned_reviewer_id)
                  .filter(Boolean),
              ),
            ];
            const reviewerById = new Map();
            if (chainReviewerIds.length > 0) {
              const { data: chainReviewers } = await supabase
                .from("profiles")
                .select("id, first_name, last_name, email, username, is_admin")
                .in("id", chainReviewerIds);
              (chainReviewers || []).forEach((p) => reviewerById.set(p.id, p));
            }
            allRevisions = (chainSubs || []).map((s) => ({
              ...s,
              profiles: s.instructor_id === data.instructor_id ? profile : null,
              reviewer: reviewerById.get(s.reviewed_by || s.assigned_reviewer_id) || null,
            }));
          }
        }

        setRevisions(
          allRevisions.length > 0 ? allRevisions : [{ ...data, profiles: profile }],
        );

        // Fetch relevant audit logs for this quiz
        const { data: logs } = await supabase
          .from("audit_trail")
          .select("*")
          .eq("record_id", data.quiz_id)
          .order("created_at", { ascending: false });

        setAuditLogs(logs || []);
        setFeedbackInput(data.faculty_head_feedback || "");
        setHeadQuestionFeedback(data.faculty_head_question_feedback || {});
        setSubmission({ ...data, profiles: profile, reviewer, section: sectionData });
      }
    } catch (err) {
      console.error("Error loading submission:", err);
      notify.error("Failed to load submission");
    } finally {
      setLoading(false);
    }
  };

  // Senior Faculty submitters live under /admin-dashboard; instructors would be
  // bounced to their own dashboard by the route guard otherwise.
  const getSubmitterSubmissionsLink = () =>
    submission?.profiles?.is_admin
      ? "/admin-dashboard/my-submissions"
      : "/instructor-dashboard/my-submissions";

  const getHeadComments = () => {
    const overall = feedbackInput.trim();
    const perQuestion = Object.fromEntries(
      Object.entries(headQuestionFeedback)
        .map(([k, v]) => [k, (v || "").trim()])
        .filter(([, v]) => v),
    );
    const combined = formatQuestionComments(
      overall,
      perQuestion,
      submission?.analysis_results?.analysis,
    );
    return { overall, perQuestion, combined };
  };

  const hasHeadComments = () => {
    const { overall, perQuestion } = getHeadComments();
    return Boolean(overall) || Object.keys(perQuestion).length > 0;
  };

  const handleApprove = async () => {
    const confirmed = await confirm({
      title: "Are you sure you want to approve this exam?",
      confirmText: "Approve & Publish",
      cancelText: "Cancel",
      variant: "success",
    });
    if (!confirmed) return;

    setPendingAction("approve");
    try {
      const now = new Date().toISOString();
      // Optional comments are kept with the approval too
      const { overall, perQuestion, combined } = getHeadComments();
      const hasPerQuestion = Object.keys(perQuestion).length > 0;
      const { error } = await updateSubmissionAsHead(
        submissionId,
        {
          status: HEAD_STATUSES.APPROVED,
          faculty_head_approved_by: user?.id,
          faculty_head_approved_at: now,
        },
        {
          faculty_head_reviewed_by: user?.id,
          faculty_head_reviewed_at: now,
          faculty_head_feedback: overall || null,
        },
        {},
        { faculty_head_question_feedback: hasPerQuestion ? perQuestion : null },
        { faculty_head_feedback: combined || null },
      );

      if (error) throw error;

      // Update quiz to published/approved so questions enter Question Bank, and clean revision suffix
      if (submission?.quiz_id) {
        const { data: currentQuiz } = await supabase
          .from("quizzes")
          .select("title")
          .eq("id", submission.quiz_id)
          .single();

        const cleanTitle = (currentQuiz?.title || submission.quizzes?.title || "").replace(
          /\s*\(Revised(?:\s+\d+)?\)\s*$/,
          ""
        );

        await supabase
          .from("quizzes")
          .update({
            is_published: true,
            ...(cleanTitle ? { title: cleanTitle } : {}),
          })
          .eq("id", submission.quiz_id);
      }

      // Notify the instructor
      const quizTitle = submission.quizzes?.title || "your exam";
      await supabase.from("notifications").insert({
        user_id: submission.instructor_id,
        title: "Exam Approved by Department Head",
        message: `Your exam analysis for "${cleanQuizTitle(quizTitle)}" has been approved by the Department Head.`,
        type: "success",
        link: getSubmitterSubmissionsLink(),
      });

      window.dispatchEvent(new Event("pending-quiz-approvals-changed"));

      // Log workflow history status change
      if (submission.quiz_id) {
        await supabase.rpc("log_quiz_status_change", {
          p_quiz_id: submission.quiz_id,
          p_new_status: "approved",
          p_reason: "Approved by Department Head",
        });
      }

      // Log the audit event
      await logAudit({
        action: "QUIZ_APPROVED",
        tableName: "quizzes",
        recordId: submission.quiz_id,
        itemName: cleanQuizTitle(quizTitle),
        subjectName: submission.section?.subject_code || null,
        sectionName: submission.section?.name || null,
        previousStatus: HEAD_STATUSES.PENDING,
        newStatus: HEAD_STATUSES.APPROVED,
        reason: "Approved by Department Head",
        userRole: "faculty_head",
        newValues: {
          submissionId: submission.id,
          quizTitle: quizTitle,
          instructorId: submission.instructor_id,
          status: HEAD_STATUSES.APPROVED,
        },
      });
      notify.success("Exam approved successfully!");
      navigate(`/faculty-head-dashboard/quiz-approvals?tab=${HEAD_STATUSES.APPROVED}`);
    } catch (err) {
      console.error("Error approving submission:", err);
      notify.error("Failed to approve submission");
    } finally {
      setPendingAction(null);
    }
  };

  const runExport = async (kind) => {
    if (exporting) return;
    setExporting(kind);
    try {
      if (kind === "pdf") await exportSubmissionTosPdf(submission, user?.id);
      else await exportSubmissionQuizPaper(submission, user?.id);
    } catch (err) {
      console.error("Export failed:", err);
      notify.error("Export failed. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  const handleRequestRevision = async () => {
    if (!hasHeadComments()) {
      notify.error("Add an overall comment or a comment on at least one question first.");
      return;
    }

    const confirmed = await confirm({
      title: "Send this exam back for revision?",
      confirmText: "Send Revision Request",
      cancelText: "Cancel",
      variant: "warning",
    });
    if (!confirmed) return;

    setPendingAction("revision");
    try {
      const now = new Date().toISOString();
      const { overall, perQuestion, combined: feedback } = getHeadComments();
      const hasPerQuestion = Object.keys(perQuestion).length > 0;
      // The reviewer's admin_feedback and question_feedback are preserved;
      // the Department Head's comments go to their own columns.
      const { error } = await updateSubmissionAsHead(
        submissionId,
        { status: HEAD_STATUSES.RETURNED, updated_at: now },
        {
          faculty_head_feedback: overall || null,
          faculty_head_reviewed_by: user?.id,
          faculty_head_reviewed_at: now,
        },
        { admin_feedback: feedback },
        { faculty_head_question_feedback: hasPerQuestion ? perQuestion : null },
        { faculty_head_feedback: feedback },
      );

      if (error) throw error;

      const quizTitle = submission.quizzes?.title || "your exam";

      // Notify instructor
      await supabase.from("notifications").insert({
        user_id: submission.instructor_id,
        title: "Revision Requested by Department Head",
        message: `The Department Head requested changes for "${cleanQuizTitle(quizTitle)}": "${feedback.slice(0, 100)}${feedback.length > 100 ? "..." : ""}"`,
        type: "warning",
        link: getSubmitterSubmissionsLink(),
      });

      window.dispatchEvent(new Event("pending-quiz-approvals-changed"));
      window.dispatchEvent(new Event("submissions-changed"));

      // Log workflow history status change
      if (submission.quiz_id) {
        await supabase.rpc("log_quiz_status_change", {
          p_quiz_id: submission.quiz_id,
          p_new_status: "rejected",
          p_reason: feedback,
        });
      }

      // Audit log
      await logAudit({
        action: "REVISION_REQUESTED",
        tableName: "quizzes",
        recordId: submission.quiz_id,
        itemName: cleanQuizTitle(quizTitle),
        subjectName: submission.section?.subject_code || null,
        sectionName: submission.section?.name || null,
        previousStatus: HEAD_STATUSES.PENDING,
        newStatus: HEAD_STATUSES.RETURNED,
        reason: feedback,
        userRole: "faculty_head",
        newValues: {
          submissionId: submission.id,
          quizTitle: quizTitle,
          instructorId: submission.instructor_id,
          feedback,
          status: HEAD_STATUSES.RETURNED,
        },
      });

      notify.success("Revision requested successfully!");
      navigate(`/faculty-head-dashboard/quiz-approvals?tab=${HEAD_STATUSES.RETURNED}`);
    } catch (err) {
      console.error("Error requesting revision:", err);
      notify.error("Failed to submit revision request.");
    } finally {
      setPendingAction(null);
    }
  };

  const getLevelColor = (level) => {
    const colors = {
      Remembering: "bg-blue-100 text-blue-700 border-blue-300",
      Understanding: "bg-cyan-100 text-cyan-700 border-cyan-300",
      Applying: "bg-green-100 text-green-700 border-green-300",
      Analyzing: "bg-yellow-100 text-yellow-700 border-yellow-300",
      Evaluating: "bg-orange-100 text-orange-700 border-orange-300",
      Creating: "bg-purple-100 text-purple-700 border-purple-300",
    };
    return colors[level] || "bg-gray-100 text-gray-700 border-gray-300";
  };

  const getThinkingOrderStyle = (order) => {
    return order === "HOTS"
      ? "bg-amber-500 text-white"
      : "bg-emerald-500 text-white";
  };

  const getStatusBadge = (status) => {
    const styles = {
      faculty_head_review: "bg-yellow-100 text-yellow-700 border-yellow-300",
      faculty_head_approved: "bg-green-100 text-green-700 border-green-300",
      revision_requested: "bg-orange-100 text-orange-700 border-orange-300",
    };
    const labels = {
      faculty_head_review: "Pending Approval",
      faculty_head_approved: "Approved",
      revision_requested: "Returned for Revision",
    };
    return (
      <span
        className={`px-3 py-1 rounded-full text-sm font-bold border ${styles[status] || "bg-gray-100 text-gray-700 border-gray-300"}`}
      >
        {labels[status] || status}
      </span>
    );
  };

  const formatDateTime = (dateStr) =>
    dateStr
      ? new Date(dateStr).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "—";

  if (loading) {
    return (
      <div className="flex-1 overflow-auto bg-authentic-white" aria-label="Loading approval review">
        <div className="bg-gradient-to-r from-brand-navy to-brand-indigo px-6 py-8">
          <Skeleton tone="bg-white/20" className="h-8 w-80 max-w-full rounded-md mb-2" />
          <Skeleton tone="bg-white/20" className="h-4 w-56 max-w-full rounded-md" />
        </div>
        <div className="p-6 space-y-4">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            <SkeletonTableRow cells={4} />
            <SkeletonTableRow cells={4} />
            <SkeletonTableRow cells={4} />
          </div>
        </div>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="p-6">
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center">
          <p className="text-rose-700 text-sm font-semibold">Submission not found.</p>
          <button
            onClick={() => navigate("/faculty-head-dashboard/quiz-approvals")}
            className="mt-4 px-4 py-2 bg-brand-navy hover:bg-brand-indigo text-white rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/40"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const results = submission.analysis_results;
  const snapshotById = (results?.questionSnapshots || []).reduce(
    (acc, item) => {
      acc[String(item.questionId)] = item;
      return acc;
    },
    {},
  );
  const snapshotByText = (results?.questionSnapshots || []).reduce(
    (acc, item) => {
      const key = normalizeQuestionText(item.questionText);
      if (key && !acc[key]) acc[key] = item;
      return acc;
    },
    {},
  );

  return (
    <>
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-brand-navy to-brand-indigo px-6 py-8">
        <button
          onClick={() => navigate("/faculty-head-dashboard/quiz-approvals")}
          aria-label="Back to exam approvals"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-semibold transition-all mb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Approvals
        </button>
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white">
              {cleanQuizTitle(submission.quizzes?.title || "Exam Analysis Review")}
            </h1>
            <p className="text-white/60 text-sm mt-1">
              Submitted by{" "}
              <span className="text-white/90 font-semibold">
                {getProfileName(submission.profiles)}
              </span>{" "}
              on {formatDateTime(submission.created_at)}
            </p>
            {submission.reviewer && (
              <p className="text-white/60 text-sm mt-0.5">
                Reviewed by{" "}
                <span className="text-white/90 font-semibold">
                  {getProfileName(submission.reviewer)}
                </span>{" "}
                ({submission.reviewer.is_admin ? "Senior Faculty" : "Peer Reviewer"})
                {submission.reviewed_at && <> on {formatDateTime(submission.reviewed_at)}</>}
              </p>
            )}
          </div>
          <div className="ml-auto flex items-center gap-3">
            {getStatusBadge(submission.status)}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Status Tracker Timeline */}
        <ExamStatusTimeline submission={submission} historyLogs={auditLogs} />

        {/* Revision History */}
        <ExamRevisionHistory revisions={revisions} currentSubmissionId={submission.id} />

        {/* Department Head comments (kept separate from reviewer feedback).
            While pending they are edited in the comment boxes below. */}
        {submission.faculty_head_feedback && submission.status !== HEAD_STATUSES.PENDING && (
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl">
            <p className="text-sm font-semibold text-orange-700 mb-1">
              {submission.status === HEAD_STATUSES.RETURNED
                ? "Department Head Revision Request:"
                : "Department Head Comments:"}
            </p>
            <p className="text-orange-900 whitespace-pre-wrap">{submission.faculty_head_feedback}</p>
            {submission.faculty_head_reviewed_at && (
              <p className="text-xs text-orange-500 mt-2">
                Returned on {formatDateTime(submission.faculty_head_reviewed_at)}
              </p>
            )}
          </div>
        )}

        {/* Reviewer Overall Feedback */}
        {submission.admin_feedback && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <p className="text-sm font-semibold text-blue-700 mb-1">
              {formatReviewerLabel(submission.reviewer)}
              <span className="font-normal text-blue-600"> — Overall Feedback:</span>
            </p>
            <p className="text-blue-800 whitespace-pre-wrap">{submission.admin_feedback}</p>
            {submission.reviewed_at && (
              <p className="text-xs text-blue-400 mt-2">
                Reviewed on {formatDateTime(submission.reviewed_at)}
              </p>
            )}
          </div>
        )}

        {/* Per-Question Feedback Summary */}
        {submission.question_feedback &&
          Object.keys(submission.question_feedback).length > 0 && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-sm font-semibold text-blue-700 mb-2">
                {formatReviewerLabel(submission.reviewer)}
                <span className="font-normal text-blue-600"> — Per-Question Feedback:</span>
              </p>
              <div className="space-y-2">
                {results?.analysis?.map((item, idx) => {
                  const fb = submission.question_feedback[item.questionId];
                  if (!fb) return null;
                  return (
                    <div
                      key={item.questionId}
                      className="p-3 bg-white rounded-lg border border-blue-100"
                    >
                      <p className="text-xs font-bold text-gray-500 mb-0.5">
                        Q{idx + 1}:{" "}
                        <span className="font-normal text-gray-700">
                          {item.questionText.length > 100
                            ? item.questionText.slice(0, 100) + "..."
                            : item.questionText}
                        </span>
                      </p>
                      <p className="text-sm text-blue-800">{fb}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        {/* Instructor Message */}
        {submission.instructor_message && (
          <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-xl">
            <p className="text-sm font-semibold text-gray-700 mb-1">
              {getProfileName(submission.profiles, "Instructor")}
              <span className="font-normal text-gray-500"> (Instructor) — Note:</span>
            </p>
            <p className="text-gray-800">{submission.instructor_message}</p>
          </div>
        )}

        {/* Summary Section */}
        <div className="mb-8 p-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4">
            Analysis Summary
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow-sm text-center">
              <p className="text-3xl font-bold text-gray-800">
                {results?.summary?.totalQuestions || 0}
              </p>
              <p className="text-sm text-gray-500">Total Questions</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm text-center">
              <p className="text-3xl font-bold text-emerald-600">
                {results?.summary?.lotsCount || 0}
              </p>
              <p className="text-sm text-gray-500">
                LOTS ({results?.summary?.lotsPercentage || 0}%)
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm text-center">
              <p className="text-3xl font-bold text-amber-600">
                {results?.summary?.hotsCount || 0}
              </p>
              <p className="text-sm text-gray-500">
                HOTS ({results?.summary?.hotsPercentage || 0}%)
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm text-center">
              <p className="text-3xl font-bold text-red-600">
                {results?.summary?.flaggedCount || 0}
              </p>
              <p className="text-sm text-gray-500">Needs Review</p>
            </div>
          </div>

          {/* Distribution */}
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <p className="text-sm font-semibold text-gray-600 mb-3">
              Bloom's Level Distribution
            </p>
            <div className="flex flex-wrap gap-2">
              {results?.summary?.distribution &&
                [
                  "Remembering",
                  "Understanding",
                  "Applying",
                  "Analyzing",
                  "Evaluating",
                  "Creating",
                ].map((level) => {
                  const count = results.summary.distribution[level] ?? 0;
                  return (
                    <div
                      key={level}
                      className={`px-3 py-2 rounded-lg border ${getLevelColor(level)} flex items-center gap-2`}
                    >
                      <span className="font-semibold">{level}:</span>
                      <span className="font-bold">{count}</span>
                    </div>
                  );
                })}
            </div>
          </div>

          {results?.summary?.flaggedCount > 0 && (
            <div className="mt-4 p-3 bg-brand-navy/5 border border-brand-navy/20 rounded-lg text-brand-navy text-sm flex items-center gap-2">
              
              <span>
                <strong>{results.summary.flaggedCount}</strong> question(s) have
                low confidence and may need manual review.
              </span>
            </div>
          )}
        </div>

        {/* Bloom's Visualization Charts */}
        <div className="mb-8">
          <BloomsVisualizationPanel summary={results?.summary} />
        </div>

        {/* Quiz Improvement Suggestions */}
        <div className="mb-8">
          <QuizSuggestions summary={results?.summary} />
        </div>

        {/* Question Analysis */}
        <div className="mb-8">
          <h3 className="text-lg font-bold text-gray-800 mb-4">
            Question Analysis
          </h3>
          <div className="space-y-4">
            {results?.analysis?.map((item, idx) => {
              const questionMeta =
                snapshotById[String(item.questionId)] ||
                snapshotByText[normalizeQuestionText(item.questionText)] ||
                questionMetaById[String(item.questionId)] ||
                questionMetaByText[normalizeQuestionText(item.questionText)] ||
                questionMetaByIndex[idx] ||
                null;
              const options = Array.isArray(questionMeta?.options)
                ? questionMeta.options
                : [];

              return (
                <div
                  key={item.questionId}
                  className={`border-2 rounded-lg p-4 transition-colors ${
                    item.needsReview
                      ? "border-yellow-400 bg-yellow-50"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-bold text-gray-500">
                          Q{idx + 1}
                        </span>
                        <span
                          className={`px-2 py-1 rounded text-xs font-bold ${getThinkingOrderStyle(item.thinkingOrder)}`}
                        >
                          {item.thinkingOrder}
                        </span>
                        <span
                          className={`px-2 py-1 rounded text-xs font-bold border ${getLevelColor(item.bloomsLevel)}`}
                        >
                          {item.bloomsLevel}
                        </span>
                        {(() => {
                          const gadEval = analyzeGADQuestion(item.questionText || "", options);
                          return (
                            <>
                              {gadEval.hasGenderBias && (
                                <span
                                  className="px-2 py-0.5 rounded text-xs font-bold bg-brand-navy/10 text-brand-navy border border-brand-navy/20 flex items-center gap-1"
                                  title={`Gender-biased word: "${gadEval.biasMatches[0]?.matchedText}" -> Suggested: "${gadEval.biasMatches[0]?.neutral}" (CSC/PCW Standard)`}
                                >
                                  Gender Bias: <strong className="underline">{gadEval.biasMatches[0]?.matchedText}</strong> to <strong>{gadEval.biasMatches[0]?.neutral}</strong>
                                </span>
                              )}
                              {gadEval.isGadThematic && (
                                <span
                                  className="px-2 py-0.5 rounded text-xs font-bold bg-brand-navy/10 text-brand-navy border border-brand-navy/20 flex items-center gap-1"
                                  title="Contains Gender and Development (GAD) theme"
                                >
                                  GAD Theme
                                </span>
                              )}
                              {!gadEval.hasGenderBias && !gadEval.isGadThematic && (
                                <span
                                  className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200"
                                  title="Uses Gender-Fair Language"
                                >
                                  Gender-Fair
                                </span>
                              )}
                              {questionMeta?.ai_generated && (
                                <span className="px-2 py-0.5 rounded text-xs font-bold bg-brand-navy/10 text-brand-navy border border-brand-navy/20">
                                  AI Generated
                                </span>
                              )}
                              {questionMeta?.ai_revised && (
                                <span className="px-2 py-0.5 rounded text-xs font-bold bg-brand-indigo/10 text-brand-indigo border border-brand-indigo/20">
                                  AI Revised
                                </span>
                              )}
                            </>
                          );
                        })()}
                        {item.needsReview && (
                          <span className="px-2 py-1 rounded text-xs font-bold bg-yellow-100 text-yellow-700 border border-yellow-300">
                            Low Confidence
                          </span>
                        )}
                      </div>
                      <p className="text-gray-800">{item.questionText}</p>

                      {options.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {options.map((opt, optIdx) => {
                            const letter = String.fromCharCode(65 + optIdx);
                            const isCorrect =
                              String(opt) ===
                              String(questionMeta.correctAnswer);
                            return (
                              <div
                                key={`${item.questionId}-opt-${optIdx}`}
                                className={`text-sm border rounded-md px-3 py-2 ${
                                  isCorrect
                                    ? "border-green-300 bg-green-50 text-green-800"
                                    : "border-gray-200 bg-gray-50 text-gray-700"
                                }`}
                              >
                                <span className="font-semibold mr-2">
                                  {letter}.
                                </span>
                                <span>{opt}</span>
                                {isCorrect && (
                                  <span className="ml-2 text-xs font-bold text-green-700">
                                    Correct
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-sm text-gray-500">Confidence</p>
                      <p
                        className={`text-lg font-bold ${
                          item.confidence >= 0.9
                            ? "text-green-600"
                            : item.confidence >= 0.75
                              ? "text-yellow-600"
                              : "text-red-600"
                        }`}
                      >
                        {(item.confidence * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {/* Inline per-question reviewer feedback */}
                  {submission.question_feedback?.[item.questionId] && (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-xs font-semibold text-blue-600 mb-0.5">
                        {formatReviewerLabel(submission.reviewer)}:
                      </p>
                      <p className="text-sm text-blue-800 whitespace-pre-wrap">
                        {submission.question_feedback[item.questionId]}
                      </p>
                    </div>
                  )}

                  {/* Department Head comment for this question */}
                  {submission.status === HEAD_STATUSES.PENDING ? (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <label
                        htmlFor={`head-comment-${item.questionId}`}
                        className="block text-xs font-semibold text-gray-500 mb-1.5"
                      >
                        Your comment on Q{idx + 1}{" "}
                        <span className="font-normal text-gray-400">(optional)</span>
                      </label>
                      <textarea
                        id={`head-comment-${item.questionId}`}
                        value={headQuestionFeedback[item.questionId] || ""}
                        onChange={(e) =>
                          setHeadQuestionFeedback((prev) => ({
                            ...prev,
                            [item.questionId]: e.target.value,
                          }))
                        }
                        placeholder={`Add a comment for Q${idx + 1}...`}
                        rows={2}
                        disabled={actionLoading}
                        className="w-full px-3 py-2 text-sm text-brand-navy border border-gray-300 rounded-lg placeholder:text-slate-400 focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 resize-none bg-white"
                      />
                    </div>
                  ) : (
                    headQuestionFeedback[item.questionId] && (
                      <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                        <p className="text-xs font-semibold text-orange-600 mb-0.5">
                          Department Head:
                        </p>
                        <p className="text-sm text-orange-800 whitespace-pre-wrap">
                          {headQuestionFeedback[item.questionId]}
                        </p>
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Overall comment + Approve & Request Revision */}
        {submission.status === HEAD_STATUSES.PENDING && (
          <div>
            <label
              htmlFor="approval-feedback"
              className="block text-sm font-semibold text-gray-700 mb-2"
            >
              Overall Comment{" "}
              <span className="text-gray-400 font-normal">
                (required to request a revision unless you commented on a question)
              </span>
            </label>
            <textarea
              id="approval-feedback"
              rows={3}
              value={feedbackInput}
              onChange={(e) => setFeedbackInput(e.target.value)}
              disabled={actionLoading}
              placeholder="Overall comments for the instructor: question edits, Bloom's level updates, or items that require modification..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-brand-navy placeholder:text-slate-400 focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 transition-all"
            />
            <p className="text-[11px] text-gray-400 mt-1.5">
              The reviewer's feedback is kept; your comments are shown to the instructor separately.
            </p>
          </div>
        )}

        {submission.status === HEAD_STATUSES.PENDING && (
          <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleRequestRevision}
              disabled={actionLoading || !hasHeadComments()}
              title={hasHeadComments() ? undefined : "Add a comment first"}
              className="px-6 py-3 bg-white hover:bg-slate-50 text-brand-navy border-2 border-brand-navy/20 hover:border-brand-navy/40 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              {pendingAction === "revision" ? "Submitting..." : "Request Revision"}
            </button>

            <button
              onClick={handleApprove}
              disabled={actionLoading}
              className="px-8 py-3 bg-brand-navy hover:bg-brand-navy/90 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center gap-2 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/40"
            >
              {pendingAction === "approve" ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Approving...
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Approve Exam
                </>
              )}
            </button>
          </div>
        )}

        {/* Returned banner */}
        {submission.status === HEAD_STATUSES.RETURNED && (
          <div className="p-6 bg-orange-50 border border-orange-200 rounded-xl text-center">
            <h3 className="text-lg font-bold text-orange-800 mb-1">
              Returned to the instructor for revision
            </h3>
            <p className="text-orange-600 text-sm">
              The revised version will come back to Exam Approvals after it passes review again.
            </p>
          </div>
        )}

        {/* After approval - approved banner with exports */}
        {submission.status === HEAD_STATUSES.APPROVED && (
          <div className="p-6 bg-green-50 border border-green-200 rounded-xl text-center">
            <h3 className="text-lg font-bold text-green-800 mb-1">
              This exam has been approved
            </h3>
            {submission.faculty_head_approved_at && (
              <p className="text-green-600 text-sm mb-4">
                Approved on {formatDateTime(submission.faculty_head_approved_at)}
              </p>
            )}
            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={() => runExport("pdf")}
                disabled={!!exporting}
                aria-busy={exporting === "pdf"}
                className="px-5 py-2.5 bg-brand-navy hover:bg-brand-navy/90 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/40"
              >
                {exporting === "pdf" && (
                  <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                )}
                {exporting === "pdf" ? "Exporting…" : "Export TOS PDF"}
              </button>
              <button
                onClick={() => runExport("paper")}
                disabled={!!exporting}
                aria-busy={exporting === "paper"}
                className="px-5 py-2.5 bg-brand-navy hover:bg-brand-indigo text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/40"
              >
                {exporting === "paper" && (
                  <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                )}
                {exporting === "paper" ? "Exporting…" : "Export Exam Paper"}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};


