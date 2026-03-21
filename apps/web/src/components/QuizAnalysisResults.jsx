import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { analyzeQuiz } from "../services/quizAnalysisService";
import { supabase } from "../supabaseClient";

/**
 * QuizAnalysisResults Component
 * Displays Bloom's Taxonomy analysis results for quiz questions
 */
export const QuizAnalysisResults = ({
  quizId,
  questions,
  instructorId,
  onClose,
}) => {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [forwarded, setForwarded] = useState(false);
  const [forwardLoading, setForwardLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [existingSubmission, setExistingSubmission] = useState(null);

  // Check for existing submission that needs revision
  useEffect(() => {
    if (quizId && quizId !== "draft") {
      checkExistingSubmission();
    }
  }, [quizId]);

  const checkExistingSubmission = async () => {
    try {
      const { data } = await supabase
        .from("quiz_analysis_submissions")
        .select("id, status, admin_feedback")
        .eq("quiz_id", quizId)
        .eq("instructor_id", instructorId)
        .in("status", ["revision_requested", "rejected"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setExistingSubmission(data);
      }
    } catch (err) {
      console.error("Error checking existing submission:", err);
    }
  };

  const handleAnalyze = async () => {
    if (!questions || questions.length === 0) {
      setError("No questions to analyze.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Transform questions to the format expected by the API
      const questionsForApi = questions.map((q) => ({
        id: String(q.id),
        text: q.text,
      }));

      const data = await analyzeQuiz(quizId, questionsForApi);
      setResults(data);
    } catch (err) {
      setError(err.message || "Could not connect to AI backend.");
    } finally {
      setLoading(false);
    }
  };

  const handleForward = async () => {
    if (!results) return;

    // Check if quizId is a draft (not saved yet)
    if (quizId === "draft" || !quizId) {
      setError("Please save the quiz first before forwarding to admin.");
      return;
    }

    setForwardLoading(true);
    setError("");

    try {
      if (existingSubmission) {
        // Resubmission: update existing submission
        const { error: updateError } = await supabase
          .from("quiz_analysis_submissions")
          .update({
            analysis_results: results,
            instructor_message: message || null,
            status: "pending",
            admin_feedback: null,
            reviewed_by: null,
            reviewed_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingSubmission.id);

        if (updateError) throw updateError;

        setForwarded(true);
        toast.success("Quiz analysis resubmitted for admin review!");
      } else {
        // New submission
        const { error: insertError } = await supabase
          .from("quiz_analysis_submissions")
          .insert({
            quiz_id: quizId,
            instructor_id: instructorId,
            analysis_results: results,
            instructor_message: message || null,
            status: "pending",
          });

        if (insertError) throw insertError;

        setForwarded(true);
        toast.success("Quiz analysis forwarded to admin for review!");
      }
    } catch (err) {
      console.error("Forward error:", err);
      setError(err.message || "Failed to forward to admin.");
    } finally {
      setForwardLoading(false);
    }
  };

  // Color mapping for Bloom's levels
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-indigo-600 to-purple-600">
          <div>
            <h2 className="text-2xl font-bold text-white">
              Bloom's Taxonomy Analysis
            </h2>
            <p className="text-indigo-100 text-sm mt-1">
              AI-powered cognitive level classification
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white text-3xl font-bold leading-none"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Resubmission Banner */}
          {existingSubmission && !results && (
            <div
              className={`mb-4 p-4 rounded-lg border ${
                existingSubmission.status === "revision_requested"
                  ? "bg-orange-50 border-orange-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <p
                className={`text-sm font-semibold mb-1 ${
                  existingSubmission.status === "revision_requested"
                    ? "text-orange-700"
                    : "text-red-700"
                }`}
              >
                {existingSubmission.status === "revision_requested"
                  ? "Revision Requested by Admin"
                  : "Previously Rejected"}
              </p>
              {existingSubmission.admin_feedback && (
                <p
                  className={`text-sm ${
                    existingSubmission.status === "revision_requested"
                      ? "text-orange-600"
                      : "text-red-600"
                  }`}
                >
                  Feedback: {existingSubmission.admin_feedback}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-2">
                Re-analyze your questions and resubmit for review.
              </p>
            </div>
          )}

          {!results ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🧠</div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                {existingSubmission
                  ? "Re-analyze Your Quiz"
                  : "Ready to Analyze"}
              </h3>
              <p className="text-gray-500 mb-6">
                Classify your {questions?.length || 0} questions according to
                Bloom's Taxonomy cognitive levels.
              </p>

              {error && (
                <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg text-sm max-w-md mx-auto">
                  {error}
                </div>
              )}

              <button
                onClick={handleAnalyze}
                disabled={loading || !questions?.length}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin">⏳</span> Analyzing...
                  </span>
                ) : (
                  "Analyze with AI"
                )}
              </button>
            </div>
          ) : (
            <>
              {/* Summary Section */}
              <div className="mb-8 p-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4">
                  Analysis Summary
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white p-4 rounded-lg shadow-sm text-center">
                    <p className="text-3xl font-bold text-gray-800">
                      {results.summary.totalQuestions}
                    </p>
                    <p className="text-sm text-gray-500">Total Questions</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm text-center">
                    <p className="text-3xl font-bold text-emerald-600">
                      {results.summary.lotsCount}
                    </p>
                    <p className="text-sm text-gray-500">
                      LOTS ({results.summary.lotsPercentage}%)
                    </p>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm text-center">
                    <p className="text-3xl font-bold text-amber-600">
                      {results.summary.hotsCount}
                    </p>
                    <p className="text-sm text-gray-500">
                      HOTS ({results.summary.hotsPercentage}%)
                    </p>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm text-center">
                    <p className="text-3xl font-bold text-red-600">
                      {results.summary.flaggedCount}
                    </p>
                    <p className="text-sm text-gray-500">Needs Review</p>
                  </div>
                </div>

                {/* Distribution Chart */}
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <p className="text-sm font-semibold text-gray-600 mb-3">
                    Bloom's Level Distribution
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(results.summary.distribution).map(
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

                {results.summary.flaggedCount > 0 && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm flex items-center gap-2">
                    <span className="text-xl">⚠️</span>
                    <span>
                      <strong>{results.summary.flaggedCount}</strong>{" "}
                      question(s) have low confidence and may need manual
                      review.
                    </span>
                  </div>
                )}
              </div>

              {/* Per-Question Results */}
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-4">
                  Question Analysis
                </h3>
                <div className="space-y-4">
                  {results.analysis.map((item, idx) => (
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
            </>
          )}
        </div>

        {/* Footer */}
        {results && (
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            {!forwarded && (
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Message to Admin (optional)
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Add any notes or context for the admin reviewer..."
                  rows="2"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-20"
                />
              </div>
            )}
            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}
            <div className="flex justify-between items-center">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleForward}
                disabled={forwarded || forwardLoading || quizId === "draft"}
                title={quizId === "draft" ? "Save the quiz first" : ""}
                className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                  forwarded
                    ? "bg-green-500 text-white cursor-default"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white"
                } disabled:opacity-75 disabled:cursor-not-allowed`}
              >
                {forwarded
                  ? existingSubmission
                    ? "✓ Resubmitted to Admin"
                    : "✓ Forwarded to Admin"
                  : forwardLoading
                    ? existingSubmission
                      ? "Resubmitting..."
                      : "Forwarding..."
                    : existingSubmission
                      ? "Resubmit to Admin"
                      : "Forward to Admin"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
