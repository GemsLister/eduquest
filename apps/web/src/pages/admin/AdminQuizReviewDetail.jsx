import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { supabase } from "../../supabaseClient";
import { BloomsVisualizationPanel } from "../../components/BloomsVisualization";
import { QuizSuggestions } from "../../components/QuizSuggestions";
import { exportBloomsPdf } from "../../utils/exportBloomsPdf";

export const AdminQuizReviewDetail = () => {
  const navigate = useNavigate();
  const { submissionId } = useParams();
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  useEffect(() => {
    loadSubmission();
  }, [submissionId]);

  const loadSubmission = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("quiz_analysis_submissions")
        .select("*, quizzes(title, description, duration)")
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

        setSubmission({ ...data, profiles: profile });
        setFeedback(data.admin_feedback || "");
      }
    } catch (err) {
      console.error("Error loading submission:", err);
      toast.error("Failed to load submission");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (status) => {
    if (status !== "approved" && !feedback.trim()) {
      setPendingAction(status);
      setShowFeedbackModal(true);
      return;
    }

    setActionLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("quiz_analysis_submissions")
        .update({
          status,
          admin_feedback: feedback || null,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", submissionId);

      if (error) throw error;

      // Send notification to instructor
      const quizTitle = submission.quizzes?.title || "your quiz";
      const notificationMap = {
        approved: {
          title: "Quiz Analysis Approved",
          message: `Your quiz analysis for "${quizTitle}" has been approved by the admin.`,
          type: "success",
        },
        revision_requested: {
          title: "Revision Requested",
          message: `The admin has requested revisions for your quiz analysis of "${quizTitle}".${feedback ? ` Feedback: ${feedback}` : ""}`,
          type: "warning",
        },
        rejected: {
          title: "Quiz Analysis Rejected",
          message: `Your quiz analysis for "${quizTitle}" has been rejected.${feedback ? ` Feedback: ${feedback}` : ""}`,
          type: "error",
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
        approved: "Quiz analysis approved successfully!",
        revision_requested: "Revision request sent to instructor.",
        rejected: "Quiz analysis has been rejected.",
      };

      toast.success(messages[status]);
      navigate("/admin-dashboard/quiz-reviews");
    } catch (err) {
      console.error("Error updating submission:", err);
      toast.error("Failed to update submission");
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
      rejected: "bg-red-100 text-red-700 border-red-300",
    };
    const labels = {
      pending: "Pending Review",
      approved: "Approved",
      revision_requested: "Revision Requested",
      rejected: "Rejected",
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
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
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

  return (
    <>
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-purple-800 to-indigo-700 px-6 py-8">
        <button
          onClick={() => navigate("/admin-dashboard/quiz-reviews")}
          className="text-indigo-200 hover:text-white font-semibold mb-4 flex items-center gap-1"
        >
          ← Back to Reviews
        </button>
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white">
              {submission.quizzes?.title || "Quiz Analysis Review"}
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
            <button
              onClick={() => {
                const instructorName = submission.profiles
                  ? `${submission.profiles.first_name || ""} ${submission.profiles.last_name || ""}`.trim() ||
                    submission.profiles.username ||
                    submission.profiles.email
                  : undefined;
                exportBloomsPdf({
                  quizTitle: submission.quizzes?.title,
                  results: submission.analysis_results,
                  instructorName,
                  submittedAt: submission.created_at,
                  adminFeedback: submission.admin_feedback,
                  status: submission.status,
                });
              }}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-semibold transition-colors flex items-center gap-1.5 text-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export PDF
            </button>
            {getStatusBadge(submission.status)}
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Resubmission Banner */}
        {submission.updated_at &&
          submission.updated_at !== submission.created_at &&
          submission.status === "pending" && (
            <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center gap-3">
              <span className="text-2xl">🔄</span>
              <div>
                <p className="text-sm font-semibold text-indigo-700">
                  Resubmission
                </p>
                <p className="text-xs text-indigo-600">
                  This analysis was resubmitted by the instructor after revision.
                  Updated on{" "}
                  {new Date(submission.updated_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
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
                Object.entries(results.summary.distribution).map(
                  ([level, count]) => (
                    <div
                      key={level}
                      className={`px-3 py-2 rounded-lg border ${getLevelColor(level)} flex items-center gap-2`}
                    >
                      <span className="font-semibold">{level}:</span>
                      <span className="font-bold">{count}</span>
                    </div>
                  ),
                )}
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
            {results?.analysis?.map((item, idx) => (
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
              </div>
            ))}
          </div>
        </div>

        {/* Admin Feedback */}
        {submission.status === "pending" && (
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Admin Feedback (required for revision/rejection)
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Enter feedback for the instructor..."
              rows="3"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-20"
            />
          </div>
        )}

        {/* Previous Feedback */}
        {submission.admin_feedback && submission.status !== "pending" && (
          <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-xl">
            <p className="text-sm font-semibold text-gray-600 mb-1">
              Admin Feedback:
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
              onClick={() => handleAction("rejected")}
              disabled={actionLoading}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
            >
              Reject
            </button>
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
              Approve
            </button>
          </div>
        )}
      </div>

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              {pendingAction === "rejected"
                ? "Rejection Feedback"
                : "Revision Request Feedback"}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Please provide feedback to help the instructor understand your
              decision.
            </p>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Enter your feedback..."
              rows="4"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500 mb-4"
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
                disabled={!feedback.trim() || actionLoading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50"
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
