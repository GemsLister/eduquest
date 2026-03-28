import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { analyzeQuiz } from "../services/quizAnalysisService";
import { supabase } from "../supabaseClient";
import { BloomsVisualizationPanel } from "./BloomsVisualization";
import { QuizSuggestions } from "./QuizSuggestions";
import { exportBloomsPdf } from "../utils/exportBloomsPdf";

/**
 * Progress Stepper — shows 3 workflow steps
 */
const ProgressStepper = ({ currentStep }) => {
  
  const steps = [
    {
      label: "Analyze",
      icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
    },
    {
      label: "Review Results",
      icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
    },
    { label: "Submit to Admin", icon: "M12 19l9 2-9-18-9 18 9-2zm0 0v-8" },
  ];
  return (
    
    <div className="flex items-center justify-center gap-1 px-6 py-3 bg-black/20">
      {steps.map((step, idx) => {
        const isActive = idx === currentStep;
        const isCompleted = idx < currentStep;

        return (
          <div key={step.label} className="flex items-center">
            <div className="flex items-center gap-1.5">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  isCompleted
                    ? "bg-green-400 text-white"
                    : isActive
                      ? "bg-brand-gold text-brand-navy"
                      : "bg-white/20 text-white/50"
                }`}
              >
                {isCompleted ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  idx + 1
                )}
              </div>
              <span
                className={`text-xs font-semibold transition-colors ${
                  isActive
                    ? "text-white"
                    : isCompleted
                      ? "text-green-300"
                      : "text-white/40"
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`w-8 h-px mx-2 ${
                  isCompleted ? "bg-green-400" : "bg-white/20"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

/**
 * QuizAnalysisResults Component
 * Displays Bloom's Taxonomy analysis results for quiz questions
 */
export const QuizAnalysisResults = ({
  quizId,
  quizTitle,
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
  const [showQuestionDetails, setShowQuestionDetails] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [shareToken, setShareToken] = useState("");
  const [quizDescription, setQuizDescription] = useState("");
  const [quizDuration, setQuizDuration] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [selectedSectionIds, setSelectedSectionIds] = useState([]);

  // Check for existing submission that needs revision
  useEffect(() => {
    if (quizId && quizId !== "draft") {
      checkExistingSubmission();
    }
  }, [quizId]);

  const handleSaveQuiz = async (publish = false) => {
    setError("");
    setSaveStatus("Saving...");

    if (!quizTitle.trim()) {
      setError("Quiz title is required");
      setSaveStatus("");
      return;
    }

    if (publish && questions.length === 0) {
      setError("Add at least one question before publishing");
      setSaveStatus("");
      return;
    }

    for (let q of questions) {
      if (!q.text.trim()) {
        setError("All questions must have text");
        setSaveStatus("");
        return;
      }
      if (
        q.type === "mcq" &&
        q.options.filter((opt) => opt.trim()).length < 2
      ) {
        setError(
          publish
            ? "MCQ questions must have at least 2 options to publish"
            : "Warning: MCQ questions should have at least 2 options",
        );
        if (publish) {
          setSaveStatus("");
          return;
        }
      }
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("User not authenticated");
        setLoading(false);
        setSaveStatus("");
        return;
      }

      let quizData;
      let newToken = shareToken;

      if (quizId) {
        // Always generate a new share token when publishing, even if one exists
        if (publish) {
          newToken = generateShareToken();
        }

        const { data, error: updateError } = await supabase
          .from("quizzes")
          .update({
            title: quizTitle,
            description: quizDescription || null,
            duration: quizDuration ? parseInt(quizDuration) : null,
            is_published: publish || isPublished,
            share_token: publish ? newToken : shareToken || null,
          })
          .eq("id", quizId)
          .select();

        if (updateError) throw updateError;
        quizData = data[0];

        const { data: existingQuestions } = await supabase
          .from("questions")
          .select("id")
          .eq("quiz_id", quizId);
        const existingQuestionIds = new Set(
          existingQuestions?.map((q) => q.id) || [],
        );

        for (const q of questions) {
          if (typeof q.id !== "number" && existingQuestionIds.has(q.id)) {
            const { error: updateQuestionError } = await supabase
              .from("questions")
              .update({
                text: q.text,
                options:
                  q.type === "mcq"
                    ? q.options.filter((opt) => opt.trim())
                    : null,
                correct_answer:
                  q.type === "mcq"
                    ? q.options[q.correctAnswer]
                    : q.type === "true_false"
                      ? q.correctAnswer === 0
                        ? "true"
                        : "false"
                      : q.correctAnswer,
                points: q.points,
              })
              .eq("id", q.id);
            if (updateQuestionError) throw updateQuestionError;
          }
        }

        const questionsToAdd = questions
          .filter((q) => typeof q.id === "number" && q.id > 10000000000)
          .map((q) => ({
            quiz_id: quizData.id,
            type: q.type,
            text: q.text,
            options:
              q.type === "mcq" ? q.options.filter((opt) => opt.trim()) : null,
            correct_answer:
              q.type === "mcq"
                ? q.options[q.correctAnswer]
                : q.type === "true_false"
                  ? q.correctAnswer === 0
                    ? "true"
                    : "false"
                  : q.correctAnswer,
            points: q.points,
          }));

        if (questionsToAdd.length > 0) {
          const { error: questionsError } = await supabase
            .from("questions")
            .insert(questionsToAdd);
          if (questionsError) throw questionsError;
        }
      } else {
        newToken = publish ? generateShareToken() : null;

        const { data: newQuiz, error: quizError } = await supabase
          .from("quizzes")
          .insert([
            {
              instructor_id: user.id,
              section_id: selectedSectionIds[0] || null,
              title: quizTitle,
              description: quizDescription || null,
              duration: quizDuration ? parseInt(quizDuration) : null,
              is_published: publish,
              share_token: newToken,
            },
          ])
          .select();

        if (quizError) throw quizError;
        if (!newQuiz || newQuiz.length === 0)
          throw new Error("Failed to create quiz");
        quizData = newQuiz[0];

        if (questions.length > 0) {
          const questionsData = questions.map((q) => ({
            quiz_id: quizData.id,
            type: q.type,
            text: q.text,
            options:
              q.type === "mcq" ? q.options.filter((opt) => opt.trim()) : null,
            correct_answer:
              q.type === "mcq"
                ? q.options[q.correctAnswer]
                : q.type === "true_false"
                  ? q.correctAnswer === 0
                    ? "true"
                    : "false"
                  : q.correctAnswer,
            points: q.points,
          }));
          const { error: questionsError } = await supabase
            .from("questions")
            .insert(questionsData);
          if (questionsError) throw questionsError;
        }
      }

      // Sync the many-to-many relationship in quiz_sections
      if (quizData) {
        try {
          const { error: deleteError } = await supabase
            .from("quiz_sections")
            .delete()
            .eq("quiz_id", quizData.id);

          // If no error deleting (meaning table exists)
          if (!deleteError && selectedSectionIds.length > 0) {
            const sectionInserts = selectedSectionIds.map((sId) => ({
              quiz_id: quizData.id,
              section_id: sId,
            }));
            await supabase.from("quiz_sections").insert(sectionInserts);
          }
        } catch (tableError) {
          console.warn("quiz_sections table might not exist yet:", tableError);
        }

        await supabase
          .from("quizzes")
          .update({
            section_id:
              selectedSectionIds.length > 0 ? selectedSectionIds[0] : null,
          })
          .eq("id", quizData.id);
      }

      if (newToken) setShareToken(newToken);

      if (publish) {
        setShowShareUrl(true);
        setSaveStatus("Quiz published! Share URL generated.");
        setTimeout(() => setSaveStatus(""), 3000);
      } else {
        setSaveStatus("Draft saved!");
        setTimeout(() => {
          setSaveStatus("");
          navigate("/instructor-dashboard/quizzes");
        }, 1000);
      }
    } catch (err) {
      setError(err.message || "Failed to save quiz");
      setSaveStatus("");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
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


  const navigate = useNavigate();
  const handleAnalyze = async () => {
    if (!questions || questions.length === 0) {
      setError("No questions to analyze.");
      return;
    }

    setLoading(true);
    setError("");

    try {
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

    if (quizId === "draft" || !quizId) {
      setError("Please save the quiz first before submitting for review.");
      return;
    }

    setForwardLoading(true);
    setError("");

    try {
      if (existingSubmission) {
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
        toast.success("Quiz submitted for admin review!");
      }
    } catch (err) {
      console.error("Forward error:", err);
      setError(err.message || "Failed to submit for review.");
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

  // Determine current step for stepper
  const currentStep = forwarded ? 2 : results ? 1 : 0;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-navy to-brand-indigo">
          <div className="p-5 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-white">
                Bloom's Taxonomy Analysis
              </h2>
              <p className="text-white/60 text-sm mt-0.5">
                AI-powered cognitive level classification
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition-colors"
            >
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          {/* Progress Stepper */}
          <ProgressStepper currentStep={currentStep} />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Resubmission Banner */}
          {existingSubmission && !results && (
            <div
              className={`mb-5 p-4 rounded-lg border ${
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
            /* ─── Step 1: Ready to Analyze ─── */
            <div className="text-center py-10">
              <div className="w-20 h-20 mx-auto mb-5 bg-brand-gold/15 rounded-2xl flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-10 w-10 text-brand-gold-dark"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                {existingSubmission
                  ? "Re-analyze Your Quiz"
                  : "Ready to Analyze"}
              </h3>
              <p className="text-gray-500 mb-2 max-w-md mx-auto">
                Our AI will classify your{" "}
                <span className="font-semibold text-gray-700">
                  {questions?.length || 0} questions
                </span>{" "}
                into Bloom's Taxonomy cognitive levels and check compliance with
                the school's Table of Specifications.
              </p>
              <p className="text-xs text-gray-400 mb-6 max-w-sm mx-auto">
                Each question will be categorized as LOTS (Remembering,
                Understanding, Applying) or HOTS (Analyzing, Evaluating,
                Creating) with a confidence score.
              </p>

              {error && (
                <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg text-sm max-w-md mx-auto">
                  {error}
                </div>
              )}

              <button
                onClick={handleAnalyze}
                disabled={loading || !questions?.length}
                className="bg-brand-gold hover:bg-brand-gold-dark text-brand-navy px-8 py-3 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Analyzing...
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
                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                      />
                    </svg>
                    Analyze with AI
                  </>
                )}
              </button>
            </div>
          ) : (
            /* ─── Step 2: Review Results ─── */
            <>
              {/* Summary Cards — color-coded */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="bg-brand-navy/5 border border-brand-navy/20 p-4 rounded-xl text-center">
                  <p className="text-3xl font-bold text-brand-navy">
                    {results.summary.totalQuestions}
                  </p>
                  <p className="text-xs font-semibold text-brand-navy/60 mt-1">
                    Total Questions
                  </p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-center">
                  <p className="text-3xl font-bold text-emerald-600">
                    {results.summary.lotsCount}
                  </p>
                  <p className="text-xs font-semibold text-emerald-500 mt-1">
                    LOTS ({results.summary.lotsPercentage}%)
                  </p>
                </div>
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-center">
                  <p className="text-3xl font-bold text-amber-600">
                    {results.summary.hotsCount}
                  </p>
                  <p className="text-xs font-semibold text-amber-500 mt-1">
                    HOTS ({results.summary.hotsPercentage}%)
                  </p>
                </div>
                <div
                  className={`p-4 rounded-xl text-center ${
                    results.summary.flaggedCount > 0
                      ? "bg-red-50 border border-red-200"
                      : "bg-gray-50 border border-gray-200"
                  }`}
                >
                  <p
                    className={`text-3xl font-bold ${
                      results.summary.flaggedCount > 0
                        ? "text-red-600"
                        : "text-gray-400"
                    }`}
                  >
                    {results.summary.flaggedCount}
                  </p>
                  <p
                    className={`text-xs font-semibold mt-1 ${
                      results.summary.flaggedCount > 0
                        ? "text-red-500"
                        : "text-gray-400"
                    }`}
                  >
                    Needs Review
                  </p>
                </div>
              </div>

              {/* TOS Compliance Badge — prominent */}
              {(() => {
                const lotsPct = results.summary.lotsPercentage || 0;
                const hotsPct = results.summary.hotsPercentage || 0;
                const isCompliant =
                  Math.abs(lotsPct - 30) <= 5 && Math.abs(hotsPct - 70) <= 5;

                return (
                  <div
                    className={`mb-6 p-4 rounded-xl border-2 flex items-center gap-4 ${
                      isCompliant
                        ? "bg-green-50 border-green-300"
                        : "bg-red-50 border-red-300"
                    }`}
                  >
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                        isCompliant
                          ? "bg-green-500 text-white"
                          : "bg-red-500 text-white"
                      }`}
                    >
                      {isCompliant ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-6 w-6"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-6 w-6"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                          />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <p
                        className={`font-bold text-sm ${
                          isCompliant ? "text-green-800" : "text-red-800"
                        }`}
                      >
                        {isCompliant ? "TOS Compliant" : "TOS Non-Compliant"}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        School requirement: 30% LOTS / 70% HOTS (with 5%
                        tolerance)
                      </p>
                      <div className="flex gap-4 mt-1">
                        <span
                          className={`text-xs font-semibold ${
                            Math.abs(lotsPct - 30) <= 5
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          LOTS: {lotsPct}%
                          {lotsPct !== 30 &&
                            ` (${lotsPct > 30 ? "+" : ""}${lotsPct - 30}%)`}
                        </span>
                        <span
                          className={`text-xs font-semibold ${
                            Math.abs(hotsPct - 70) <= 5
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          HOTS: {hotsPct}%
                          {hotsPct !== 70 &&
                            ` (${hotsPct > 70 ? "+" : ""}${hotsPct - 70}%)`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* LOTS vs HOTS Visual Bar Chart */}
              {(() => {
                const lotsPct = results.summary.lotsPercentage || 0;
                const hotsPct = results.summary.hotsPercentage || 0;
                const lotsTarget = 30;
                const hotsTarget = 70;

                return (
                  <div className="mb-6 p-5 bg-white rounded-xl border border-gray-200">
                    <h4 className="text-sm font-bold text-gray-800 mb-4">
                      LOTS vs HOTS Distribution
                    </h4>

                    {/* Stacked horizontal bar */}
                    <div className="relative mb-2">
                      <div className="flex h-10 rounded-lg overflow-hidden">
                        {lotsPct > 0 && (
                          <div
                            className="bg-emerald-500 flex items-center justify-center text-white text-xs font-bold transition-all duration-500"
                            style={{ width: `${lotsPct}%` }}
                          >
                            {lotsPct >= 10 && `LOTS ${lotsPct}%`}
                          </div>
                        )}
                        {hotsPct > 0 && (
                          <div
                            className="bg-amber-500 flex items-center justify-center text-white text-xs font-bold transition-all duration-500"
                            style={{ width: `${hotsPct}%` }}
                          >
                            {hotsPct >= 10 && `HOTS ${hotsPct}%`}
                          </div>
                        )}
                      </div>

                      {/* 30/70 target line */}
                      <div
                        className="absolute top-0 bottom-0 border-l-2 border-dashed border-gray-800"
                        style={{ left: `${lotsTarget}%` }}
                      >
                        <div className="absolute -top-5 -translate-x-1/2 text-[10px] font-semibold text-gray-600 whitespace-nowrap">
                          Target 30/70
                        </div>
                      </div>
                    </div>

                    {/* Legend */}
                    <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded bg-emerald-500" />
                          <span>
                            LOTS ({results.summary.lotsCount} questions)
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded bg-amber-500" />
                          <span>
                            HOTS ({results.summary.hotsCount} questions)
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 border-t-2 border-dashed border-gray-800" />
                        <span>30/70 Target</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Bloom's Visualization Charts */}
              <div className="mb-6">
                <BloomsVisualizationPanel summary={results.summary} />
              </div>

              {/* Quiz Improvement Suggestions */}
              <div className="mb-6">
                <QuizSuggestions summary={results.summary} />
              </div>

              {/* Per-Question Breakdown — collapsible */}
              <div className="mb-6">
                <button
                  onClick={() => setShowQuestionDetails(!showQuestionDetails)}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 text-gray-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                    <span className="font-bold text-gray-800">
                      Per-Question Breakdown
                    </span>
                    <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs font-semibold rounded-full">
                      {results.analysis.length} questions
                    </span>
                  </div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-5 w-5 text-gray-400 transition-transform ${
                      showQuestionDetails ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {showQuestionDetails && (
                  <div className="mt-3 border border-gray-200 rounded-xl overflow-hidden">
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      <div className="col-span-1">#</div>
                      <div className="col-span-5">Question</div>
                      <div className="col-span-2">Level</div>
                      <div className="col-span-2">Type</div>
                      <div className="col-span-2 text-right">Confidence</div>
                    </div>
                    {/* Table Rows */}
                    <div className="divide-y divide-gray-100">
                      {results.analysis.map((item, idx) => (
                        <div
                          key={item.questionId}
                          className={`grid grid-cols-12 gap-2 px-4 py-3 items-center text-sm ${
                            item.needsReview ? "bg-yellow-50" : "bg-white"
                          }`}
                        >
                          <div className="col-span-1 text-gray-400 font-semibold">
                            {idx + 1}
                          </div>
                          <div
                            className="col-span-5 text-gray-700 truncate"
                            title={item.questionText}
                          >
                            {item.questionText}
                          </div>
                          <div className="col-span-2">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs font-bold border ${getLevelColor(
                                item.bloomsLevel,
                              )}`}
                            >
                              {item.bloomsLevel}
                            </span>
                          </div>
                          <div className="col-span-2">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${getThinkingOrderStyle(
                                item.thinkingOrder,
                              )}`}
                            >
                              {item.thinkingOrder}
                            </span>
                            {item.needsReview && (
                              <span
                                className="ml-1 text-yellow-500 text-xs"
                                title="Low confidence"
                              >
                                !
                              </span>
                            )}
                          </div>
                          <div className="col-span-2 text-right">
                            <span
                              className={`font-semibold ${
                                item.confidence >= 0.9
                                  ? "text-green-600"
                                  : item.confidence >= 0.75
                                    ? "text-yellow-600"
                                    : "text-red-600"
                              }`}
                            >
                              {(item.confidence * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Submit to Admin — grouped card */}
              {!forwarded ? (
                <div className="bg-brand-navy/5 border border-brand-navy/20 rounded-xl p-5">
                  <h4 className="font-bold text-gray-800 mb-1">
                    Submit for Admin Review
                  </h4>
                  <p className="text-xs text-gray-500 mb-3">
                    Send your analysis results to the admin for approval. You
                    can include a message for context.
                  </p>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Add any notes or context for the admin reviewer..."
                    rows="2"
                    className="w-full px-4 py-2 border border-brand-navy/20 rounded-lg focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold focus:ring-opacity-20 text-sm mb-3 bg-white"
                  />
                  {error && (
                    <div className="mb-3 p-2.5 bg-red-100 border border-red-300 text-red-700 rounded-lg text-xs">
                      {error}
                    </div>
                  )}
                  <div className="flex justify-end">
                    <button
                      onClick={handleForward}
                      disabled={forwardLoading || quizId === "draft"}
                      title={quizId === "draft" ? "Save the quiz first" : ""}
                      className="bg-brand-navy hover:bg-brand-indigo text-white px-6 py-2.5 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {forwardLoading ? (
                        <>
                          <svg
                            className="animate-spin h-4 w-4"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          {existingSubmission
                            ? "Resubmitting..."
                            : "Submitting..."}
                        </>
                      ) : (
                        <>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                            />
                          </svg>
                          {existingSubmission
                            ? "Resubmit for Review"
                            : "Submit for Review"}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 bg-green-500 rounded-full flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <p className="font-bold text-green-800">
                    {existingSubmission
                      ? "Resubmitted Successfully!"
                      : "Submitted for Review!"}
                  </p>
                  <p className="text-sm text-green-600 mt-1">
                    The admin will review your quiz analysis and provide
                    feedback.
                  </p>
                </div>
              )}
              <button
                onClick={() => {
                  handleSaveQuiz(false);
                  setHasUnsavedChanges(false);
                  setLastSaved(new Date());
                }}
                disabled={loading}
                className="bg-brand-gold hover:bg-brand-gold-dark text-brand-navy px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                {loading ? "Saving..." : "Back to Quizzes"}
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
          {results && (
            <button
              onClick={() =>
                exportBloomsPdf({
                  quizTitle: quizTitle || `Quiz ${quizId}`,
                  results,
                })
              }
              className="px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-lg font-semibold transition-colors flex items-center gap-1.5 text-sm"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Export PDF
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
