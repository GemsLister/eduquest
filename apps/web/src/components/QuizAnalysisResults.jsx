import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { notify } from "../utils/notify.jsx";
import { analyzeQuiz } from "../services/quizAnalysisService";
import { supabase } from "../supabaseClient";
import { BloomsVisualizationPanel } from "./BloomsVisualization";
import { QuizSuggestions } from "./QuizSuggestions";

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
  previousSubmissionId,
  onBeforeSubmitReview,
  onClose,
}) => {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [forwarded, setForwarded] = useState(false);
  const [forwardLoading, setForwardLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [existingSubmission, setExistingSubmission] = useState(null);
  const [showQuestionDetails, setShowQuestionDetails] = useState(false);

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
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        if (data.status === "revision_requested") {
          setExistingSubmission(data);
        } else if (
          data.status === "pending" ||
          data.status === "faculty_head_review" ||
          data.status === "approved" ||
          data.status === "faculty_head_approved"
        ) {
          setForwarded(true);
        }
      }
    } catch (err) {
      console.error("Error checking existing submission:", err);
    }
  };

  const navigate = useNavigate();
  const handleAnalyze = async () => {
    if (!questions || questions.length === 0) {
      notify.error("No questions to analyze.");
      return;
    }

    setLoading(true);

    try {
      const questionsForApi = questions.map((q) => ({
        id: String(q.id),
        text: q.text,
      }));

      const data = await analyzeQuiz(quizId, questionsForApi);
      setResults(data);
    } catch (err) {
      notify.error(err.message || "Could not connect to AI backend.");
    } finally {
      setLoading(false);
    }
  };

  const handleForward = async () => {
    if (!results) return;

    if (quizId === "draft" || !quizId) {
      notify.error("Please save the quiz first before submitting for review.");
      return;
    }

    setForwardLoading(true);

    try {
      const analysisPayload = {
        ...results,
        questionSnapshots: (questions || []).map((q, idx) => ({
          orderIndex: idx,
          questionId: String(q.id),
          questionText: q.text,
          type: q.type,
          options:
            q.type === "mcq" && Array.isArray(q.options)
              ? q.options.filter((opt) => String(opt || "").trim())
              : [],
          correctAnswer:
            q.type === "mcq"
              ? q.options?.[q.correctAnswer] || null
              : (q.correctAnswer ?? null),
        })),
      };

      if (onBeforeSubmitReview) {
        const saved = await onBeforeSubmitReview();
        if (!saved) {
          notify.error(
            "Please fix quiz issues and save before submitting for review.",
          );
          return;
        }
      }

      // Determine which previous submission to link to
      const prevSubId =
        previousSubmissionId || existingSubmission?.id || null;

      const { error: insertError } = await supabase
        .from("quiz_analysis_submissions")
        .insert({
          quiz_id: quizId,
          instructor_id: instructorId,
          analysis_results: analysisPayload,
          instructor_message: message || null,
          status: "pending",
          previous_submission_id: prevSubId,
        });

      if (insertError) throw insertError;

      setForwarded(true);
      notify.success(
        prevSubId
          ? "Revised quiz submitted for admin review!"
          : "Quiz submitted for admin review!",
      );
    } catch (err) {
      console.error("Forward error:", err);
      notify.error(err.message || "Failed to submit for review.");
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
                            ` (${30 - lotsPct > 0 ? "+" : ""}${30 - lotsPct}%)`}
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
                            ` (${70 - hotsPct > 0 ? "+" : ""}${70 - hotsPct}%)`}
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
                          className={`grid grid-cols-12 gap-2 px-4 py-3 items-start text-sm ${
                            item.needsReview ? "bg-yellow-50" : "bg-white"
                          }`}
                        >
                          <div className="col-span-1 text-gray-400 font-semibold pt-0.5">
                            {idx + 1}
                          </div>
                          <div
                            className="col-span-5 text-gray-700 break-words"
                            title={item.questionText}
                          >
                            {item.questionText}
                          </div>
                          <div className="col-span-2 pt-0.5">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs font-bold border ${getLevelColor(
                                item.bloomsLevel,
                              )}`}
                            >
                              {item.bloomsLevel}
                            </span>
                          </div>
                          <div className="col-span-2 pt-0.5">
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
                          <div className="col-span-2 text-right pt-0.5">
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
                          {existingSubmission || previousSubmissionId
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
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <button
            onClick={() => {
              onClose();
              navigate("/instructor-dashboard/quizzes");
            }}
            className="bg-brand-gold hover:bg-brand-gold-dark text-brand-navy px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors flex items-center gap-2"
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
                d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
              />
            </svg>
            Back to Quizzes
          </button>
        </div>
      </div>
    </div>
  );
};
