import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { notify } from "../../utils/notify.jsx";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { logAudit } from "../../services/auditService.js";
import { BloomsVisualizationPanel } from "../../components/BloomsVisualization";
import { QuizSuggestions } from "../../components/QuizSuggestions";
import { analyzeGADQuestion } from "../../services/gadAnalysisService.js";

/**
 * Revision suggestion templates for F7.
 * Available as quick-fill options in the per-question feedback area.
 */
const REVISION_TEMPLATES = [
  { label: "Rephrase for clarity", text: "Please rephrase this question for better clarity and precision." },
  { label: "Raise cognitive level", text: "Consider revising this question to a higher Bloom's level (e.g., from Remembering to Analyzing/Evaluating) for better HOTS alignment." },
  { label: "Lower cognitive level", text: "This question may be too complex for the target audience. Consider simplifying to align with LOTS objectives." },
  { label: "Review answer options", text: "The answer choices need revision — some distractors are too obvious or the correct answer is ambiguous. Please review all options." },
  { label: "Add more context", text: "This question lacks sufficient context. Add a scenario or more specific details so students can answer accurately." },
  { label: "Fix grammatical errors", text: "This question has grammatical or spelling errors. Please proofread and correct before submission." },
];

export const PeerReviewDetail = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { submissionId } = useParams();
  const [submission, setSubmission] = useState(null);
  const [chain, setChain] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [questionFeedback, setQuestionFeedback] = useState({});
  const [questionMetaById, setQuestionMetaById] = useState({});
  const [questionMetaByText, setQuestionMetaByText] = useState({});
  const [questionMetaByIndex, setQuestionMetaByIndex] = useState([]);
  const [previousSnapshots, setPreviousSnapshots] = useState([]);
  // F7: Track which question has the template popover open
  const [openTemplateFor, setOpenTemplateFor] = useState(null);

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
        .select("*, quizzes(*)")
        .eq("id", submissionId)
        .single();

      if (error) throw error;

      if (data) {
        // Fetch submitting instructor profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name, email, username")
          .eq("id", data.instructor_id)
          .single();

        // Fetch live question metadata
        const { data: questionRows } = await supabase
          .from("questions")
          .select("id, text, type, options, correct_answer")
          .eq("quiz_id", data.quiz_id)
          .order("created_at", { ascending: true });

        const metaMapById = (questionRows || []).reduce((acc, q) => {
          acc[String(q.id)] = { type: q.type, text: q.text, options: q.options || [], correctAnswer: q.correct_answer };
          return acc;
        }, {});

        const metaMapByText = (questionRows || []).reduce((acc, q) => {
          const key = normalizeQuestionText(q.text);
          if (key && !acc[key]) {
            acc[key] = { type: q.type, text: q.text, options: q.options || [], correctAnswer: q.correct_answer };
          }
          return acc;
        }, {});

        setQuestionMetaById(metaMapById);
        setQuestionMetaByText(metaMapByText);
        setQuestionMetaByIndex((questionRows || []).map((q) => ({
          type: q.type, text: q.text, options: q.options || [], correctAnswer: q.correct_answer,
        })));

        setSubmission({ ...data, profiles: profile });
        setFeedback(data.admin_feedback || "");
        setQuestionFeedback(data.question_feedback || {});

        // Build submission chain for version banners
        const rootId = data.quizzes?.parent_quiz_id || data.quiz_id;
        if (rootId) {
          const { data: chainQuizzes } = await supabase
            .from("quizzes")
            .select("id")
            .or(`id.eq.${rootId},parent_quiz_id.eq.${rootId}`);

          const chainQuizIds = (chainQuizzes || []).map((q) => q.id);
          if (chainQuizIds.length > 0) {
            const { data: chainSubs } = await supabase
              .from("quiz_analysis_submissions")
              .select("id, quiz_id, created_at, analysis_results")
              .in("quiz_id", chainQuizIds)
              .order("created_at", { ascending: true });

            const builtChain = chainSubs || [];
            setChain(builtChain.map(({ id, quiz_id, created_at }) => ({ id, quiz_id, created_at })));

            const currentIdx = builtChain.findIndex((s) => s.id === submissionId);
            if (currentIdx > 0) {
              const prevSub = builtChain[currentIdx - 1];
              setPreviousSnapshots(prevSub?.analysis_results?.questionSnapshots || []);
            }
          }
        }
      }
    } catch (err) {
      console.error("Error loading peer review submission:", err);
      notify.error("Failed to load submission");
    } finally {
      setLoading(false);
    }
  };

  const hasAnyFeedback = () => {
    if (feedback.trim()) return true;
    return Object.values(questionFeedback).some((f) => f.trim());
  };

  const handleAction = async (status) => {
    if (status !== "approved" && !hasAnyFeedback()) {
      setPendingAction(status);
      setShowFeedbackModal(true);
      return;
    }

    setActionLoading(true);
    try {
      // When peer reviewer approves, forward to department head
      const actualStatus = status === "approved" ? "faculty_head_review" : status;

      const filteredQuestionFeedback = Object.fromEntries(
        Object.entries(questionFeedback).filter(([, v]) => v.trim())
      );

      const { error } = await supabase
        .from("quiz_analysis_submissions")
        .update({
          status: actualStatus,
          admin_feedback: feedback || null,
          question_feedback: Object.keys(filteredQuestionFeedback).length > 0 ? filteredQuestionFeedback : null,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", submissionId);

      if (error) throw error;

      const quizTitle = submission.quizzes?.title || "your quiz";
      const targetQuizId = submission.quiz_id;

      if (targetQuizId) {
        try {
          await supabase.rpc("log_quiz_status_change", {
            p_quiz_id: targetQuizId,
            p_new_status: status === "approved" ? "forwarded_to_head" : "rejected",
            p_reason: feedback || (status === "approved" ? "Forwarded to Department Head by Peer Reviewer" : "Revision requested by Peer Reviewer"),
          });

          await logAudit({
            action: status === "approved" ? "PEER_REVIEW_FORWARDED_TO_HEAD" : "PEER_REVIEW_REVISION_REQUESTED",
            tableName: "quizzes",
            recordId: targetQuizId,
            itemName: quizTitle,
            previousStatus: "submitted_for_review",
            newStatus: status === "approved" ? "forwarded_to_head" : "revision_requested",
            reason: feedback || (status === "approved" ? "Forwarded to Department Head by Peer Reviewer" : "Revision requested by Peer Reviewer"),
            userRole: "peer_reviewer",
          });
        } catch (lErr) {
          console.warn("Could not log peer review action:", lErr);
        }
      }

      // Notify the instructor
      const notificationMap = {
        approved: {
          title: "Quiz Analysis Peer-Reviewed",
          message: `Your quiz analysis for "${quizTitle}" has been peer-reviewed and forwarded to the Department Head for final approval.`,
          type: "info",
        },
        revision_requested: {
          title: "Revision Requested by Peer Reviewer",
          message: `Your peer reviewer has requested revisions for your quiz analysis of "${quizTitle}".${feedback ? ` Feedback: ${feedback}` : ""}`,
          type: "warning",
        },
      };

      const notification = notificationMap[status];
      if (notification) {
        await supabase.from("notifications").insert({
          user_id: submission.instructor_id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          link: `/instructor-dashboard/my-submissions`,
        });
      }

      // If approved/forwarded, also notify Department Heads for final approval
      if (status === "approved") {
        try {
          const { data: deptHeads } = await supabase
            .from("profiles")
            .select("id")
            .eq("is_faculty_head", true);

          if (deptHeads && deptHeads.length > 0) {
            const headNotifs = deptHeads.map((h) => ({
              user_id: h.id,
              title: "New Exam Awaiting Final Approval",
              message: `Quiz "${quizTitle}" has passed peer review and is awaiting your final department head approval.`,
              type: "info",
              link: `/faculty-head/quiz-approvals`,
            }));
            await supabase.from("notifications").insert(headNotifs);
          }
        } catch (nErr) {
          console.warn("Could not notify department heads:", nErr);
        }
      }

      window.dispatchEvent(new Event("pending-peer-reviews-changed"));

      notify.success(
        status === "approved"
          ? "Quiz forwarded to Department Head for final approval!"
          : "Revision request sent to instructor."
      );
      navigate("/instructor-dashboard/my-submissions?tab=peer_reviews");
    } catch (err) {
      console.error("Error updating submission:", err);
      notify.error("Failed to update submission");
    } finally {
      setActionLoading(false);
      setShowFeedbackModal(false);
    }
  };

  // --- Helpers ---
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

  const getThinkingOrderStyle = (order) =>
    order === "HOTS" ? "bg-amber-500 text-white" : "bg-emerald-500 text-white";

  const getStatusBadge = (status) => {
    const styles = {
      pending: "bg-yellow-100 text-yellow-700 border-yellow-300",
      approved: "bg-green-100 text-green-700 border-green-300",
      revision_requested: "bg-orange-100 text-orange-700 border-orange-300",
      faculty_head_review: "bg-blue-100 text-blue-700 border-blue-300",
      faculty_head_approved: "bg-green-100 text-green-700 border-green-300",
    };
    const labels = {
      pending: "Pending Review",
      approved: "Approved",
      revision_requested: "Revision Requested",
      faculty_head_review: "Awaiting Dept. Head",
      faculty_head_approved: "Dept. Head Approved",
    };
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-bold border ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand-gold"></div>
          <p className="mt-4 text-gray-600 font-semibold">Loading review...</p>
        </div>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-600">Submission not found.</p>
          <button onClick={() => navigate("/instructor-dashboard/peer-reviews")} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const results = submission.analysis_results;
  const snapshotById = (results?.questionSnapshots || []).reduce((acc, item) => {
    acc[String(item.questionId)] = item;
    return acc;
  }, {});
  const snapshotByText = (results?.questionSnapshots || []).reduce((acc, item) => {
    const key = normalizeQuestionText(item.questionText);
    if (key && !acc[key]) acc[key] = item;
    return acc;
  }, {});

  const getInstructorName = (profiles) => {
    if (!profiles) return "Unknown";
    return `${profiles.first_name || ""} ${profiles.last_name || ""}`.trim() || profiles.username || profiles.email || "Unknown";
  };

  return (
    <>
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-brand-navy to-brand-indigo px-6 py-8">
        <button
          onClick={() => navigate("/instructor-dashboard/peer-reviews")}
          className="text-brand-gold hover:text-white font-semibold mb-4 flex items-center gap-1"
        >
          ← Back to Peer Reviews
        </button>
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
              {(submission.quizzes?.title || "Quiz Analysis Review").replace(/\s*\(Revised(?:\s+\d+)?\)\s*$/, "")}
              {(submission.quizzes?.version_number || 0) > 1 && (
                <span className="px-2.5 py-1 bg-white/20 text-white rounded-full text-xs font-bold">
                  V{submission.quizzes.version_number}
                </span>
              )}
            </h1>
            <p className="text-white/60 text-sm mt-1">
              Submitted by {getInstructorName(submission.profiles)}
              "Peer Review"
            </p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {getStatusBadge(submission.status)}
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Version Banner */}
        {(() => {
          const currentIdx = chain.findIndex((s) => s.id === submission.id);
          const displayVersion = currentIdx >= 0 ? currentIdx + 1 : 1;
          const chainLength = chain.length;
          const previousInChain = currentIdx > 0 ? chain[currentIdx - 1] : null;
          const latestInChain = chainLength > 0 ? chain[chainLength - 1] : null;
          const isLatest = !latestInChain || latestInChain.id === submission.id;

          if (displayVersion === 1 && chainLength > 1) {
            return (
              <div className="mb-6 p-4 bg-brand-navy/5 border border-brand-navy/20 rounded-xl flex items-center gap-3">
                
                <div className="flex-1">
                  <p className="text-sm font-semibold text-emerald-900">Original Submission</p>
                  <p className="text-xs text-emerald-900/70">This is the original version. Newer revisions exist.</p>
                </div>
                <button
                  onClick={() => navigate(`/instructor-dashboard/peer-reviews/${latestInChain.id}`)}
                  className="px-3 py-1.5 bg-emerald-700/10 hover:bg-emerald-700/20 text-emerald-900 text-xs font-semibold rounded-lg"
                >
                  View Latest
                </button>
              </div>
            );
          }
          if (displayVersion > 1) {
            return (
              <div className="mb-6 p-4 bg-brand-gold/10 border border-brand-gold/20 rounded-xl flex items-center gap-3">
                
                <div className="flex-1">
                  <p className="text-sm font-semibold text-brand-navy">Revised Submission (Version {displayVersion})</p>
                  <p className="text-xs text-brand-navy/70">The instructor revised based on previous feedback and resubmitted.</p>
                </div>
                {previousInChain && (
                  <button
                    onClick={() => navigate(`/instructor-dashboard/peer-reviews/${previousInChain.id}`)}
                    className="px-3 py-1.5 bg-brand-navy/10 hover:bg-brand-navy/20 text-brand-navy text-xs font-semibold rounded-lg"
                  >
                    View Previous
                  </button>
                )}
                {!isLatest && latestInChain && (
                  <button
                    onClick={() => navigate(`/instructor-dashboard/peer-reviews/${latestInChain.id}`)}
                    className="px-3 py-1.5 bg-brand-navy/10 hover:bg-brand-navy/20 text-brand-navy text-xs font-semibold rounded-lg"
                  >
                    View Latest
                  </button>
                )}
              </div>
            );
          }
          return null;
        })()}

        {/* Instructor Message */}
        {submission.instructor_message && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <p className="text-sm font-semibold text-blue-700 mb-1">Instructor's Note:</p>
            <p className="text-blue-800">{submission.instructor_message}</p>
          </div>
        )}

        {/* Summary */}
        <div className="mb-8 p-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Analysis Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow-sm text-center">
              <p className="text-3xl font-bold text-gray-800">{results?.summary?.totalQuestions || 0}</p>
              <p className="text-sm text-gray-500">Total Questions</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm text-center">
              <p className="text-3xl font-bold text-emerald-600">{results?.summary?.lotsCount || 0}</p>
              <p className="text-sm text-gray-500">LOTS ({results?.summary?.lotsPercentage || 0}%)</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm text-center">
              <p className="text-3xl font-bold text-amber-600">{results?.summary?.hotsCount || 0}</p>
              <p className="text-sm text-gray-500">HOTS ({results?.summary?.hotsPercentage || 0}%)</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm text-center">
              <p className="text-3xl font-bold text-red-600">{results?.summary?.flaggedCount || 0}</p>
              <p className="text-sm text-gray-500">Needs Review</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm">
            <p className="text-sm font-semibold text-gray-600 mb-3">Bloom's Level Distribution</p>
            <div className="flex flex-wrap gap-2">
              {results?.summary?.distribution &&
                ["Remembering", "Understanding", "Applying", "Analyzing", "Evaluating", "Creating"].map((level) => {
                  const count = results.summary.distribution[level] ?? 0;
                  return (
                    <div key={level} className={`px-3 py-2 rounded-lg border ${getLevelColor(level)} flex items-center gap-2`}>
                      <span className="font-semibold">{level}:</span>
                      <span className="font-bold">{count}</span>
                    </div>
                  );
                })}
            </div>
          </div>

          {results?.summary?.flaggedCount > 0 && (
            <div className="mt-4 p-3 bg-brand-navy/5 border border-brand-navy/20 rounded-lg text-brand-navy text-sm flex items-center gap-2">
              
              <span><strong>{results.summary.flaggedCount}</strong> question(s) have low confidence and may need manual review.</span>
            </div>
          )}
        </div>

        {/* Charts */}
        <div className="mb-8">
          <BloomsVisualizationPanel summary={results?.summary} />
        </div>

        {/* Suggestions */}
        <div className="mb-8">
          <QuizSuggestions summary={results?.summary} />
        </div>

        {/* Question Analysis with Side-by-Side Comparison + F7 Revision Templates */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-800">
                {previousSnapshots.length > 0 ? "Question Analysis & Revision Comparison" : "Question Analysis"}
              </h3>
              {previousSnapshots.length > 0 && (
                <p className="text-xs text-gray-500 mt-0.5">Side-by-side comparison with the previous version</p>
              )}
            </div>
            {previousSnapshots.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Modified
                </span>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-green-100 text-green-800 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> New
                </span>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" /> Unchanged
                </span>
              </div>
            )}
          </div>

          <div className="space-y-5">
            {(() => {
              const hasPrevious = previousSnapshots.length > 0;
              const maxLen = hasPrevious
                ? Math.max(previousSnapshots.length, (results?.analysis || []).length)
                : (results?.analysis || []).length;

              return Array.from({ length: maxLen }).map((_, idx) => {
                const item = results?.analysis?.[idx] || null;
                const prevSnap = hasPrevious ? previousSnapshots[idx] : null;

                const questionMeta = item
                  ? snapshotById[String(item.questionId)] ||
                    snapshotByText[normalizeQuestionText(item.questionText)] ||
                    questionMetaById[String(item.questionId)] ||
                    questionMetaByText[normalizeQuestionText(item.questionText)] ||
                    questionMetaByIndex[idx] ||
                    null
                  : null;

                const currOptions = Array.isArray(questionMeta?.options) ? questionMeta.options : [];
                const prevOptions = Array.isArray(prevSnap?.options) ? prevSnap.options : [];
                const prevText = prevSnap?.questionText || "";
                const currText = questionMeta?.text || item?.questionText || "";

                const isTextModified =
                  prevText && currText &&
                  normalizeQuestionText(prevText) !== normalizeQuestionText(currText);

                const prevCorrect = prevSnap?.correctAnswer;
                const currCorrect = questionMeta?.correctAnswer;
                const isOptionsModified =
                  hasPrevious && prevSnap && item &&
                  (prevOptions.length !== currOptions.length ||
                    prevOptions.some((opt, i) => opt !== currOptions[i]) ||
                    String(prevCorrect) !== String(currCorrect));

                const isModified = isTextModified || isOptionsModified;
                const isNew = hasPrevious && !prevSnap && item;
                const isRemoved = hasPrevious && prevSnap && !item;
                const isUnchanged = hasPrevious && prevSnap && item && !isModified;
                const questionIdKey = item ? item.questionId : `removed-${idx}`;

                return (
                  <div
                    key={questionIdKey}
                    className={`border-2 rounded-xl p-5 transition-colors ${
                      isRemoved ? "border-red-300 bg-red-50/40"
                        : item?.needsReview ? "border-yellow-400 bg-yellow-50/50"
                        : isModified ? "border-amber-300 bg-white"
                        : isNew ? "border-green-300 bg-white"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    {/* Question Header */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100 mb-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-black text-gray-700 bg-gray-100 px-2.5 py-1 rounded-md">Q{idx + 1}</span>

                        {hasPrevious && (
                          <>
                            {isRemoved && <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 border border-red-200">Removed</span>}
                            {isNew && <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700 border border-green-200">New</span>}
                            {isModified && <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">Modified</span>}
                            {isUnchanged && <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-600">Unchanged</span>}
                          </>
                        )}

                        {item && (() => {
                          const gadEval = analyzeGADQuestion(currText || item?.questionText || "", currOptions);
                          return (
                            <>
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${getThinkingOrderStyle(item.thinkingOrder)}`}>
                                {item.thinkingOrder}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getLevelColor(item.bloomsLevel)}`}>
                                {item.bloomsLevel}
                              </span>
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
                              {item.needsReview && (
                                <span className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-100 text-yellow-700 border border-yellow-300">
                                  Low Confidence
                                </span>
                              )}
                            </>
                          );
                        })()}
                      </div>

                      {item && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 font-medium">Confidence:</span>
                          <span className={`text-sm font-black ${
                            item.confidence >= 0.9 ? "text-green-600"
                              : item.confidence >= 0.75 ? "text-yellow-600"
                              : "text-red-600"
                          }`}>
                            {(item.confidence * 100).toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Question Content */}
                    {hasPrevious ? (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Left: Previous */}
                        <div className={`p-4 rounded-xl border ${
                          isRemoved ? "bg-red-50 border-red-200"
                            : isModified ? "bg-amber-50/50 border-amber-200"
                            : "bg-gray-50/80 border-gray-200"
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Previous Version</span>
                            {isRemoved && <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">Removed</span>}
                          </div>
                          {prevSnap ? (
                            <>
                              <p className={`text-sm mb-3 ${isModified || isRemoved ? "line-through text-red-500/80 font-medium" : "text-gray-800"}`}>
                                {prevSnap.questionText}
                              </p>
                              {prevOptions.length > 0 && (
                                <div className="space-y-1.5">
                                  {prevOptions.map((opt, optIdx) => {
                                    const letter = String.fromCharCode(65 + optIdx);
                                    const isCorrect = String(opt) === String(prevSnap.correctAnswer);
                                    return (
                                      <div key={optIdx} className={`text-xs border rounded-lg px-3 py-2 flex items-center justify-between ${isCorrect ? "border-green-300 bg-green-50 text-green-800 font-semibold" : "border-gray-200 bg-white text-gray-600"}`}>
                                        <div className="flex items-center gap-2">
                                          <span className="font-bold shrink-0">{letter}.</span>
                                          <span>{opt}</span>
                                        </div>
                                        {isCorrect && <span className="text-[10px] text-green-700 font-bold shrink-0">Correct</span>}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="py-6 text-center text-xs text-gray-400 italic">— Not in previous version (New question) —</div>
                          )}
                        </div>

                        {/* Right: Current */}
                        <div className={`p-4 rounded-xl border ${
                          isNew ? "bg-green-50/50 border-green-200"
                            : isModified ? "bg-amber-50/30 border-amber-200"
                            : "bg-white border-gray-200"
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-brand-indigo uppercase tracking-wider">Current Revision</span>
                            {isNew && <span className="text-[10px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded">New</span>}
                            {isModified && <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">Updated</span>}
                          </div>
                          {item ? (
                            <>
                              <p className={`text-sm mb-3 ${isModified ? "font-semibold text-amber-900" : "text-gray-800"}`}>
                                {currText || item.questionText}
                              </p>
                              {currOptions.length > 0 && (
                                <div className="space-y-1.5">
                                  {currOptions.map((opt, optIdx) => {
                                    const letter = String.fromCharCode(65 + optIdx);
                                    const isCorrect = String(opt) === String(questionMeta?.correctAnswer);
                                    return (
                                      <div key={optIdx} className={`text-xs border rounded-lg px-3 py-2 flex items-center justify-between ${isCorrect ? "border-green-400 bg-green-50 text-green-900 font-semibold" : "border-gray-200 bg-white text-gray-700"}`}>
                                        <div className="flex items-center gap-2">
                                          <span className="font-bold shrink-0">{letter}.</span>
                                          <span>{opt}</span>
                                        </div>
                                        {isCorrect && <span className="text-[10px] text-green-700 font-bold shrink-0">Correct</span>}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="py-6 text-center text-xs text-red-400 italic">— Removed in this revision —</div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-gray-800 font-medium mb-3">{item?.questionText}</p>
                        {currOptions.length > 0 && (
                          <div className="space-y-2">
                            {currOptions.map((opt, optIdx) => {
                              const letter = String.fromCharCode(65 + optIdx);
                              const isCorrect = String(opt) === String(questionMeta?.correctAnswer);
                              return (
                                <div key={optIdx} className={`text-sm border rounded-lg px-3.5 py-2.5 flex items-center justify-between ${isCorrect ? "border-green-300 bg-green-50 text-green-800 font-medium" : "border-gray-200 bg-gray-50 text-gray-700"}`}>
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-gray-500 shrink-0">{letter}.</span>
                                    <span>{opt}</span>
                                  </div>
                                  {isCorrect && <span className="text-xs font-bold text-green-700 shrink-0">Correct</span>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* F7 — Per-Question Feedback + Revision Suggestion Templates */}
                    {item && (
                      submission.status === "pending" ? (
                        <div className="mt-4 pt-3 border-t border-gray-200">
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-semibold text-gray-500">Feedback for Q{idx + 1}</label>
                            {/* F7: Suggest Revision button */}
                            <div className="relative">
                              <button
                                onClick={() => setOpenTemplateFor(openTemplateFor === questionIdKey ? null : questionIdKey)}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-brand-navy bg-brand-navy/5 hover:bg-brand-navy/10 border border-brand-navy/20 rounded-lg transition-colors"
                              >
                                Suggest Revision
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                              {openTemplateFor === questionIdKey && (
                                <div className="absolute right-0 top-full mt-1 z-20 w-72 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                                  <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                                    <p className="text-xs font-bold text-gray-600">Quick Revision Templates</p>
                                    <p className="text-[10px] text-gray-400">Click a template to pre-fill the feedback field</p>
                                  </div>
                                  <ul className="py-1">
                                    {REVISION_TEMPLATES.map((template) => (
                                      <li key={template.label}>
                                        <button
                                          onClick={() => {
                                            setQuestionFeedback((prev) => ({
                                              ...prev,
                                              [item.questionId]: template.text,
                                            }));
                                            setOpenTemplateFor(null);
                                          }}
                                          className="w-full text-left px-3 py-2 text-xs hover:bg-brand-navy/5 transition-colors"
                                        >
                                          <span className="font-semibold text-brand-navy block">{template.label}</span>
                                          <span className="text-gray-500 line-clamp-1">{template.text}</span>
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                          <textarea
                            value={questionFeedback[item.questionId] || ""}
                            onChange={(e) =>
                              setQuestionFeedback((prev) => ({ ...prev, [item.questionId]: e.target.value }))
                            }
                            placeholder={`Add feedback or use a template above for Q${idx + 1}...`}
                            rows="2"
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold focus:ring-opacity-20 resize-none bg-white"
                          />
                        </div>
                      ) : (
                        questionFeedback[item.questionId] && (
                          <div className="mt-4 pt-3 border-t border-gray-200">
                            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                              <p className="text-xs font-semibold text-orange-600 mb-1">Peer Reviewer Feedback:</p>
                              <p className="text-sm text-orange-800">{questionFeedback[item.questionId]}</p>
                            </div>
                          </div>
                        )
                      )
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Overall Feedback */}
        {submission.status === "pending" && (
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Overall Feedback <span className="text-gray-400 font-normal">(optional if per-question feedback provided)</span>
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Enter overall feedback for the instructor..."
              rows="3"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold focus:ring-opacity-20"
            />
          </div>
        )}

        {submission.admin_feedback && submission.status !== "pending" && (
          <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-xl">
            <p className="text-sm font-semibold text-gray-600 mb-1">Peer Reviewer Feedback:</p>
            <p className="text-gray-800">{submission.admin_feedback}</p>
            {submission.reviewed_at && (
              <p className="text-xs text-gray-400 mt-2">Reviewed on {new Date(submission.reviewed_at).toLocaleDateString()}</p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        {submission.status === "pending" && (
          <div className="flex flex-wrap gap-4 justify-end">
            <button
              onClick={() => handleAction("revision_requested")}
              disabled={actionLoading}
              className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
            >
              Request Revision
            </button>
            <button
              onClick={() => handleAction("approved")}
              disabled={actionLoading}
              className="px-6 py-3 bg-brand-navy hover:bg-brand-navy/90 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
            >
              Forward to Department Head
            </button>
          </div>
        )}
      </div>

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Revision Request Feedback</h3>
            <p className="text-sm text-gray-500 mb-4">
              Please provide overall feedback or per-question feedback to help the instructor understand what to revise.
            </p>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Enter your feedback..."
              rows="4"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-gold mb-4"
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction(pendingAction)}
                disabled={!hasAnyFeedback() || actionLoading}
                className="px-4 py-2 bg-brand-navy text-white rounded-lg font-semibold hover:bg-brand-indigo disabled:opacity-50"
              >
                {actionLoading ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};



