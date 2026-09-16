/**
 * Quiz Improvement Suggestions based on Bloom's Taxonomy
 * School TOS (Table of Specifications): 30% LOTS / 70% HOTS (Standard)
 * Project-Based Assessment TOS: 20% LOTS / 80% HOTS (N2)
 */

import { useState } from "react";

const TOS_MODES = {
  standard: { lotsTarget: 30, hotsTarget: 70, label: "Standard TOS" },
  project: { lotsTarget: 20, hotsTarget: 80, label: "Project-Based" },
};

const TOLERANCE = 5; // +-5% tolerance before flagging

const BLOOM_ORDER = [
  "Remembering",
  "Understanding",
  "Applying",
  "Analyzing",
  "Evaluating",
  "Creating",
];

const LOTS_LEVELS = ["Remembering", "Understanding", "Applying"];
const HOTS_LEVELS = ["Analyzing", "Evaluating", "Creating"];

// SVG Icons — uniform with system design
const CheckCircleIcon = ({ className = "h-4 w-4" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const AlertIcon = ({ className = "h-4 w-4" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
    />
  </svg>
);

const XCircleIcon = ({ className = "h-4 w-4" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const InfoIcon = ({ className = "h-4 w-4" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

/**
 * Generates suggestions based on analysis summary and TOS mode
 */
const generateSuggestions = (summary, tosMode = "standard") => {
  if (!summary) return { suggestions: [], compliance: null };

  const { lotsTarget, hotsTarget } = TOS_MODES[tosMode] || TOS_MODES.standard;

  const {
    lotsPercentage,
    hotsPercentage,
    totalQuestions,
    distribution,
    flaggedCount,
  } = summary;

  const lotsPct = lotsPercentage || 0;
  const hotsPct = hotsPercentage || 0;
  const suggestions = [];

  // Determine TOS compliance
  const lotsDeviation = lotsTarget - lotsPct;
  const hotsDeviation = hotsTarget - hotsPct;
  const isCompliant =
    Math.abs(lotsDeviation) <= TOLERANCE &&
    Math.abs(hotsDeviation) <= TOLERANCE;

  const compliance = {
    isCompliant,
    lotsPct,
    hotsPct,
    lotsTarget,
    hotsTarget,
    lotsDeviation,
    hotsDeviation,
  };

  // TOS Compliance Suggestions
  if (lotsPct > lotsTarget + TOLERANCE) {
    const excessLots = Math.round(
      ((lotsPct - lotsTarget) / 100) * totalQuestions,
    );
    suggestions.push({
      type: "warning",
      title: "Too Many LOTS Questions",
      message: `Your quiz has ${lotsPct}% LOTS questions, exceeding the ${lotsTarget}% target. Consider converting approximately ${excessLots} lower-order question(s) to higher-order thinking questions.`,
      actionItems: [
        "Replace some Remembering/Understanding questions with Analyzing or Evaluating questions",
        "Transform recall-based questions into application or analysis scenarios",
        "Add case studies or problem-solving questions that require critical thinking",
      ],
    });
  }

  if (hotsPct < hotsTarget - TOLERANCE) {
    const neededHots = Math.round(
      ((hotsTarget - hotsPct) / 100) * totalQuestions,
    );
    suggestions.push({
      type: "warning",
      title: "Insufficient HOTS Questions",
      message: `Your quiz has only ${hotsPct}% HOTS questions, below the ${hotsTarget}% target. You need approximately ${neededHots} more higher-order thinking question(s).`,
      actionItems: [
        "Add questions that ask students to analyze relationships or compare concepts",
        "Include questions requiring evaluation of arguments or justification of decisions",
        "Create questions that ask students to design, construct, or propose solutions",
      ],
    });
  }

  if (lotsPct < lotsTarget - TOLERANCE) {
    suggestions.push({
      type: "info",
      title: "LOTS Below Target",
      message: `Your quiz has only ${lotsPct}% LOTS questions, below the ${lotsTarget}% target. While having more HOTS is generally positive, the TOS requires a balance for foundational knowledge assessment.`,
      actionItems: [
        "Add some recall or definition-based questions to assess foundational knowledge",
        "Include comprehension questions that check basic understanding",
      ],
    });
  }

  if (isCompliant) {
    suggestions.push({
      type: "success",
      title: "TOS Compliant",
      message: `Your quiz meets the Table of Specifications requirement with ${lotsPct}% LOTS and ${hotsPct}% HOTS (target: ${lotsTarget}/${hotsTarget}).`,
      actionItems: [],
    });
  }

  // Level Distribution Suggestions
  if (distribution) {
    const missingLevels = BLOOM_ORDER.filter(
      (level) => !distribution[level] || distribution[level] === 0,
    );

    if (missingLevels.length > 0 && missingLevels.length <= 3) {
      suggestions.push({
        type: "info",
        title: "Missing Bloom's Levels",
        message: `Your quiz doesn't cover: ${missingLevels.join(", ")}. A well-rounded assessment should ideally touch multiple cognitive levels.`,
        actionItems: missingLevels.map((level) => {
          const tips = {
            Remembering:
              "Add questions that test recall of facts, definitions, or key terms",
            Understanding:
              "Add questions that ask students to explain, summarize, or paraphrase concepts",
            Applying:
              "Add questions that require students to use knowledge in new situations or solve practical problems",
            Analyzing:
              "Add questions that ask students to compare, contrast, categorize, or identify patterns",
            Evaluating:
              "Add questions that require students to judge, critique, or justify arguments",
            Creating:
              "Add questions that ask students to design, propose, or construct original solutions",
          };
          return `${level}: ${tips[level]}`;
        }),
      });
    }

    // Check for over-concentration in a single level
    const maxLevel = BLOOM_ORDER.reduce((max, level) => {
      return (distribution[level] || 0) > (distribution[max] || 0)
        ? level
        : max;
    }, BLOOM_ORDER[0]);
    const maxCount = distribution[maxLevel] || 0;
    const maxPct =
      totalQuestions > 0 ? Math.round((maxCount / totalQuestions) * 100) : 0;

    if (maxPct > 50) {
      suggestions.push({
        type: "warning",
        title: "Over-concentrated Level",
        message: `${maxPct}% of your questions are at the "${maxLevel}" level. Diversifying across levels provides a more comprehensive assessment of student learning.`,
        actionItems: [
          `Consider redistributing some "${maxLevel}" questions to other cognitive levels`,
          "Aim for a spread that covers at least 3-4 different Bloom's levels",
        ],
      });
    }
  }

  // Flagged Questions
  if (flaggedCount > 0) {
    suggestions.push({
      type: "info",
      title: "Low-Confidence Classifications",
      message: `${flaggedCount} question(s) received low AI confidence scores (<75%). These may be ambiguous or span multiple cognitive levels.`,
      actionItems: [
        "Review flagged questions to ensure they clearly target a specific cognitive level",
        "Reword ambiguous questions to make the intended cognitive demand clearer",
        "Consider having a colleague review these questions for clarity",
      ],
    });
  }

  // Question Count
  if (totalQuestions < 10) {
    suggestions.push({
      type: "info",
      title: "Small Question Pool",
      message: `Your quiz has only ${totalQuestions} questions. With a small pool, it's harder to achieve the ideal LOTS/HOTS distribution.`,
      actionItems: [
        "Consider adding more questions for a more reliable assessment",
        `Aim for at least ${Math.ceil(10 * (hotsTarget / 100))} HOTS and ${Math.ceil(10 * (lotsTarget / 100))} LOTS questions minimum`,
      ],
    });
  }

  return { suggestions, compliance };
};

/**
 * TOS Compliance Gauge
 */
const ComplianceGauge = ({ compliance }) => {
  if (!compliance) return null;

  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border bg-white shadow-sm">
      <div
        className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 border-2 ${
          compliance.isCompliant
            ? "bg-brand-navy/5 border-brand-navy/20"
            : "bg-gray-100 border-gray-300"
        }`}
      >
        {compliance.isCompliant ? (
          <CheckCircleIcon className="h-5 w-5 text-brand-navy" />
        ) : (
          <XCircleIcon className="h-5 w-5 text-gray-500" />
        )}
      </div>
      <div className="flex-1">
        <p
          className={`font-bold text-sm ${
            compliance.isCompliant ? "text-brand-navy" : "text-gray-700"
          }`}
        >
          {compliance.isCompliant ? "TOS Compliant" : "TOS Non-Compliant"}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          Target: {compliance.lotsTarget}% LOTS / {compliance.hotsTarget}% HOTS
        </p>
        <div className="flex gap-4 mt-1.5">
          <span
            className={`text-xs font-semibold ${
              Math.abs(compliance.lotsDeviation) <= TOLERANCE
                ? "text-brand-navy"
                : "text-gray-600"
            }`}
          >
            LOTS: {compliance.lotsPct}%{" "}
            ({compliance.lotsDeviation > 0 ? "+" : ""}
            {compliance.lotsDeviation}%)
          </span>
          <span
            className={`text-xs font-semibold ${
              Math.abs(compliance.hotsDeviation) <= TOLERANCE
                ? "text-brand-navy"
                : "text-gray-600"
            }`}
          >
            HOTS: {compliance.hotsPct}%{" "}
            ({compliance.hotsDeviation > 0 ? "+" : ""}
            {compliance.hotsDeviation}%)
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * QuizSuggestions Component
 * Renders AI-powered improvement suggestions based on Bloom's analysis.
 * Supports Standard TOS (70% HOTS / 30% LOTS) and Project-Based TOS (80% HOTS / 20% LOTS).
 */
export const QuizSuggestions = ({ summary }) => {
  const [tosMode, setTosMode] = useState("standard");
  const { suggestions, compliance } = generateSuggestions(summary, tosMode);
  const currentMode = TOS_MODES[tosMode];

  if (!summary) return null;

  // Uniform type styles using only brand + gray palette
  const typeStyles = {
    success: {
      bg: "bg-brand-navy/5",
      border: "border-brand-navy/20",
      IconComponent: CheckCircleIcon,
      iconClass: "text-brand-navy",
      titleColor: "text-brand-navy",
      textColor: "text-brand-navy/80",
      bulletColor: "text-brand-navy/50",
    },
    warning: {
      bg: "bg-gray-50",
      border: "border-gray-300",
      IconComponent: AlertIcon,
      iconClass: "text-gray-600",
      titleColor: "text-gray-800",
      textColor: "text-gray-700",
      bulletColor: "text-gray-400",
    },
    error: {
      bg: "bg-gray-50",
      border: "border-gray-300",
      IconComponent: XCircleIcon,
      iconClass: "text-gray-600",
      titleColor: "text-gray-800",
      textColor: "text-gray-700",
      bulletColor: "text-gray-400",
    },
    info: {
      bg: "bg-slate-50",
      border: "border-slate-200",
      IconComponent: InfoIcon,
      iconClass: "text-brand-navy/60",
      titleColor: "text-brand-navy",
      textColor: "text-brand-navy/70",
      bulletColor: "text-brand-navy/40",
    },
  };

  return (
    <div className="space-y-4">
      {/* Header with TOS Mode Toggle (N2) */}
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-lg font-bold text-gray-800">
          Quiz Improvement Suggestions
        </h3>

        {/* TOS Mode Selector */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg border border-gray-200">
          <button
            onClick={() => setTosMode("standard")}
            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
              tosMode === "standard"
                ? "bg-brand-navy text-white shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
            title="Standard TOS: 70% HOTS / 30% LOTS"
          >
            Standard (70/30)
          </button>
          <button
            onClick={() => setTosMode("project")}
            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
              tosMode === "project"
                ? "bg-brand-navy text-white shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
            title="Project-Based Assessment TOS: 80% HOTS / 20% LOTS"
          >
            Project-Based (80/20)
          </button>
        </div>

        <span className="px-2 py-0.5 bg-brand-navy/10 text-brand-navy text-xs font-bold rounded-full border border-brand-navy/10">
          TOS: {currentMode.lotsTarget}/{currentMode.hotsTarget}
        </span>

        {tosMode === "project" && (
          <span className="text-[11px] text-brand-navy font-medium bg-brand-gold/20 px-2 py-0.5 rounded-full border border-brand-gold/30">
            Project-Based Assessment Mode
          </span>
        )}
      </div>

      {/* TOS Compliance Gauge */}
      <ComplianceGauge compliance={compliance} />

      {/* Suggestions List */}
      <div className="space-y-3">
        {suggestions.map((suggestion, idx) => {
          const style = typeStyles[suggestion.type] || typeStyles.info;
          const { IconComponent } = style;
          return (
            <div
              key={idx}
              className={`p-4 rounded-lg border ${style.bg} ${style.border}`}
            >
              <div className="flex items-start gap-2">
                <span className="shrink-0 mt-0.5">
                  <IconComponent className={`h-4 w-4 ${style.iconClass}`} />
                </span>
                <div className="flex-1">
                  <p className={`font-semibold text-sm ${style.titleColor}`}>
                    {suggestion.title}
                  </p>
                  <p className={`text-sm mt-1 ${style.textColor}`}>
                    {suggestion.message}
                  </p>
                  {suggestion.actionItems.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {suggestion.actionItems.map((item, i) => (
                        <li
                          key={i}
                          className={`text-xs ${style.textColor} flex items-start gap-1.5`}
                        >
                          <span className={`${style.bulletColor} mt-0.5`}>
                            &rsaquo;
                          </span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
