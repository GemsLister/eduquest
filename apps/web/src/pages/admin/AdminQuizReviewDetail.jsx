import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { notify } from "../../utils/notify.jsx";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { BloomsVisualizationPanel } from "../../components/BloomsVisualization";
import { QuizSuggestions } from "../../components/QuizSuggestions";

export const AdminQuizReviewDetail = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { submissionId } = useParams();
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [questionFeedback, setQuestionFeedback] = useState({});
  const [questionMetaById, setQuestionMetaById] = useState({});
  const [questionMetaByText, setQuestionMetaByText] = useState({});
  const [questionMetaByIndex, setQuestionMetaByIndex] = useState([]);

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

      // Fetch instructor profile separately
      if (data) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name, email, username")
          .eq("id", data.instructor_id)
          .single();

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

        setSubmission({ ...data, profiles: profile });
        setFeedback(data.admin_feedback || "");
        setQuestionFeedback(data.question_feedback || {});
      }
    } catch (err) {
      console.error("Error loading submission:", err);
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
      // When admin approves, forward to department head for final approval
      const actualStatus =
        status === "approved" ? "faculty_head_review" : status;

      // Filter out empty question feedback entries
      const filteredQuestionFeedback = Object.fromEntries(
        Object.entries(questionFeedback).filter(([, v]) => v.trim()),
      );

      const { error } = await supabase
        .from("quiz_analysis_submissions")
        .update({
          status: actualStatus,
          admin_feedback: feedback || null,
          question_feedback:
            Object.keys(filteredQuestionFeedback).length > 0
              ? filteredQuestionFeedback
              : null,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", submissionId);

      if (error) throw error;

      // Send notification to instructor
      const quizTitle = submission.quizzes?.title || "your quiz";
      const notificationMap = {
        approved: {
          title: "Quiz Analysis Reviewed by Senior Faculty",
          message: `Your quiz analysis for "${quizTitle}" has been reviewed by the Senior Faculty and forwarded to the Department Head for final approval.`,
          type: "info",
        },
        revision_requested: {
          title: "Revision Requested",
          message: `The Senior Faculty has requested revisions for your quiz analysis of "${quizTitle}".${feedback ? ` Feedback: ${feedback}` : ""}`,
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

      const messages = {
        approved: "Quiz forwarded to Department Head for approval!",
        revision_requested: "Revision request sent to instructor.",
      };

      notify.success(messages[status]);
      navigate("/admin-dashboard/quiz-reviews");
    } catch (err) {
      console.error("Error updating submission:", err);
      notify.error("Failed to update submission");
    } finally {
      setActionLoading(false);
      setShowFeedbackModal(false);
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
      faculty_head_review: "Awaiting Department Head",
      faculty_head_approved: "Department Head Approved",
    };
    return (
      <span
        className={`px-3 py-1 rounded-full text-sm font-bold border ${styles[status]}`}
      >
        {labels[status]}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand-gold"></div>
          <p className="mt-4 text-gray-600 font-semibold">Loading...</p>
        </div>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-600">Submission not found.</p>
          <button
            onClick={() => navigate("/admin-dashboard/quiz-reviews")}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg"
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
          onClick={() => navigate("/admin-dashboard/quiz-reviews")}
          className="text-brand-gold hover:text-white font-semibold mb-4 flex items-center gap-1"
        >
          Back to Reviews
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
              Submitted by{" "}
              {submission.profiles
                ? `${submission.profiles.first_name || ""} ${submission.profiles.last_name || ""}`.trim() ||
                  submission.profiles.username ||
                  submission.profiles.email ||
                  "Unknown"
                : "Unknown"}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {getStatusBadge(submission.status)}
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Version / Resubmission Banner */}
        {submission.previous_submission_id && (
          <div className="mb-6 p-4 bg-brand-gold/10 border border-brand-gold/20 rounded-xl flex items-center gap-3">
            <span className="text-2xl">🔄</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-brand-navy">
                Revised Submission
                {(submission.quizzes?.version_number || 0) > 1 &&
                  ` (Version ${submission.quizzes.version_number})`}
              </p>
              <p className="text-xs text-brand-navy/70">
                The instructor revised this quiz based on previous feedback and
                resubmitted for review.
              </p>
            </div>
            <button
              onClick={() =>
                navigate(
                  `/admin-dashboard/quiz-reviews/${submission.previous_submission_id}`,
                )
              }
              className="px-3 py-1.5 bg-brand-navy/10 hover:bg-brand-navy/20 text-brand-navy text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
            >
              View Previous Version
            </button>
          </div>
        )}

        {/* Instructor Message */}
        {submission.instructor_message && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <p className="text-sm font-semibold text-blue-700 mb-1">
              Instructor's Note:
            </p>
            <p className="text-blue-800">{submission.instructor_message}</p>
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
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm flex items-center gap-2">
              <span className="text-xl">⚠️</span>
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
            {results?.analysis?.map((item, idx) =>
              (() => {
                const questionMeta =
                  snapshotById[String(item.questionId)] ||
                  snapshotByText[normalizeQuestionText(item.questionText)] ||
                  questionMetaById[String(item.questionId)] ||
                  questionMetaByText[
                    normalizeQuestionText(item.questionText)
                  ] ||
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
                          {item.needsReview && (
                            <span className="px-2 py-1 rounded text-xs font-bold bg-yellow-100 text-yellow-700 border border-yellow-300">
                              ⚠️ Low Confidence
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

                    {/* Per-question feedback */}
                    {submission.status === "pending" ? (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <textarea
                          value={questionFeedback[item.questionId] || ""}
                          onChange={(e) =>
                            setQuestionFeedback((prev) => ({
                              ...prev,
                              [item.questionId]: e.target.value,
                            }))
                          }
                          placeholder={`Add feedback for Q${idx + 1}...`}
                          rows="2"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold focus:ring-opacity-20 resize-none"
                        />
                      </div>
                    ) : (
                      questionFeedback[item.questionId] && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                            <p className="text-xs font-semibold text-orange-600 mb-1">
                              Senior Faculty Feedback:
                            </p>
                            <p className="text-sm text-orange-800">
                              {questionFeedback[item.questionId]}
                            </p>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                );
              })(),
            )}
          </div>
        </div>

        {/* Senior Faculty Feedback */}
        {submission.status === "pending" && (
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Overall Feedback (optional if per-question feedback is provided)
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Enter feedback for the instructor..."
              rows="3"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold focus:ring-opacity-20"
            />
          </div>
        )}

        {/* Previous Feedback */}
        {submission.admin_feedback && submission.status !== "pending" && (
          <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-xl">
            <p className="text-sm font-semibold text-gray-600 mb-1">
              Senior Faculty Feedback:
            </p>
            <p className="text-gray-800">{submission.admin_feedback}</p>
            {submission.reviewed_at && (
              <p className="text-xs text-gray-400 mt-2">
                Reviewed on{" "}
                {new Date(submission.reviewed_at).toLocaleDateString()}
              </p>
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
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
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
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              Revision Request Feedback
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Please provide overall feedback or per-question feedback above to
              help the instructor understand your decision.
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
