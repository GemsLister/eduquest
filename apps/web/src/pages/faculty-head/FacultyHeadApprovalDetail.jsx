import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { notify } from "../../utils/notify.jsx";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { BloomsVisualizationPanel } from "../../components/BloomsVisualization";
import { QuizSuggestions } from "../../components/QuizSuggestions";

export const FacultyHeadApprovalDetail = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { submissionId } = useParams();
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
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
        .select("*, quizzes(title, description, duration)")
        .eq("id", submissionId)
        .single();

      if (error) throw error;

      if (data) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name, email, username")
          .eq("id", data.instructor_id)
          .single();

        // Fetch section data via quiz_sections junction table
        let sectionData = null;
        if (data.quiz_id) {
          const { data: qs } = await supabase
            .from("quiz_sections")
            .select("section_id, sections(name, subject_code)")
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

        setSubmission({ ...data, profiles: profile, section: sectionData });
      }
    } catch (err) {
      console.error("Error loading submission:", err);
      notify.error("Failed to load submission");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("quiz_analysis_submissions")
        .update({
          status: "faculty_head_approved",
          faculty_head_approved_by: user?.id,
          faculty_head_approved_at: new Date().toISOString(),
        })
        .eq("id", submissionId);

      if (error) throw error;

      // Notify the instructor
      const quizTitle = submission.quizzes?.title || "your quiz";
      await supabase.from("notifications").insert({
        user_id: submission.instructor_id,
        title: "Quiz Approved by Department Head",
        message: `Your quiz analysis for "${quizTitle}" has been approved by the Department Head.`,
        type: "success",
        link: `/instructor-dashboard/my-submissions`,
      });

      window.dispatchEvent(new Event("pending-quiz-approvals-changed"));
      notify.success("Quiz approved successfully!");
      navigate("/faculty-head-dashboard/quiz-approvals");
    } catch (err) {
      console.error("Error approving submission:", err);
      notify.error("Failed to approve submission");
    } finally {
      setActionLoading(false);
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
    };
    const labels = {
      faculty_head_review: "Pending Approval",
      faculty_head_approved: "Approved",
    };
    return (
      <span
        className={`px-3 py-1 rounded-full text-sm font-bold border ${styles[status] || "bg-gray-100 text-gray-700 border-gray-300"}`}
      >
        {labels[status] || status}
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
            onClick={() => navigate("/faculty-head-dashboard/quiz-approvals")}
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
          onClick={() => navigate("/faculty-head-dashboard/quiz-approvals")}
          className="text-brand-gold hover:text-white font-semibold mb-4 flex items-center gap-1"
        >
          Back to Approvals
        </button>
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white">
              {(submission.quizzes?.title || "Quiz Analysis Review").replace(
                /\s*\(Revised(?:\s+\d+)?\)\s*$/,
                "",
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
        {/* Senior Faculty Overall Feedback */}
        {submission.admin_feedback && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <p className="text-sm font-semibold text-blue-700 mb-1">
              Senior Faculty Overall Feedback:
            </p>
            <p className="text-blue-800">{submission.admin_feedback}</p>
            {submission.reviewed_at && (
              <p className="text-xs text-blue-400 mt-2">
                Reviewed on{" "}
                {new Date(submission.reviewed_at).toLocaleDateString()}
              </p>
            )}
          </div>
        )}

        {/* Per-Question Feedback Summary */}
        {submission.question_feedback &&
          Object.keys(submission.question_feedback).length > 0 && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-sm font-semibold text-blue-700 mb-2">
                Per-Question Feedback from Senior Faculty:
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
              Instructor's Note:
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

                  {/* Inline per-question feedback */}
                  {submission.question_feedback?.[item.questionId] && (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-xs font-semibold text-blue-600 mb-0.5">
                        Senior Faculty Feedback:
                      </p>
                      <p className="text-sm text-blue-800">
                        {submission.question_feedback[item.questionId]}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Button - Approve */}
        {submission.status === "faculty_head_review" && (
          <div className="flex justify-end">
            <button
              onClick={handleApprove}
              disabled={actionLoading}
              className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {actionLoading ? (
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
                  Approve Quiz
                </>
              )}
            </button>
          </div>
        )}

        {/* After approval - show approved banner */}
        {submission.status === "faculty_head_approved" && (
          <div className="p-6 bg-green-50 border border-green-200 rounded-xl text-center">
            <div className="text-4xl mb-3">✅</div>
            <h3 className="text-lg font-bold text-green-800 mb-2">
              This quiz has been approved
            </h3>
            <p className="text-green-600 text-sm">
              You can export the PDFs from the approvals list page.
            </p>
          </div>
        )}
      </div>
    </>
  );
};
