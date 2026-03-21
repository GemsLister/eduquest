/**
 * Quiz Improvement Suggestions based on Bloom's Taxonomy
 * School TOS (Table of Specifications): 30% LOTS / 70% HOTS
 */

const TOS_LOTS_TARGET = 30;
const TOS_HOTS_TARGET = 70;
const TOLERANCE = 5; // ±5% tolerance before flagging

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

/**
 * Generates suggestions based on analysis summary
 */
const generateSuggestions = (summary) => {
  if (!summary) return { suggestions: [], compliance: null };

  const { lotsPercentage, hotsPercentage, totalQuestions, distribution, flaggedCount } =
    summary;

  const lotsPct = lotsPercentage || 0;
  const hotsPct = hotsPercentage || 0;
  const suggestions = [];

  // Determine TOS compliance
  const lotsDeviation = lotsPct - TOS_LOTS_TARGET;
  const hotsDeviation = hotsPct - TOS_HOTS_TARGET;
  const isCompliant =
    Math.abs(lotsDeviation) <= TOLERANCE &&
    Math.abs(hotsDeviation) <= TOLERANCE;

  const compliance = {
    isCompliant,
    lotsPct,
    hotsPct,
    lotsTarget: TOS_LOTS_TARGET,
    hotsTarget: TOS_HOTS_TARGET,
    lotsDeviation,
    hotsDeviation,
  };

  // ── TOS Compliance Suggestions ──
  if (lotsPct > TOS_LOTS_TARGET + TOLERANCE) {
    const excessLots = Math.round(
      ((lotsPct - TOS_LOTS_TARGET) / 100) * totalQuestions,
    );
    suggestions.push({
      type: "warning",
      title: "Too Many LOTS Questions",
      message: `Your quiz has ${lotsPct}% LOTS questions, exceeding the ${TOS_LOTS_TARGET}% target. Consider converting approximately ${excessLots} lower-order question(s) to higher-order thinking questions.`,
      actionItems: [
        "Replace some Remembering/Understanding questions with Analyzing or Evaluating questions",
        "Transform recall-based questions into application or analysis scenarios",
        "Add case studies or problem-solving questions that require critical thinking",
      ],
    });
  }

  if (hotsPct < TOS_HOTS_TARGET - TOLERANCE) {
    const neededHots = Math.round(
      ((TOS_HOTS_TARGET - hotsPct) / 100) * totalQuestions,
    );
    suggestions.push({
      type: "warning",
      title: "Insufficient HOTS Questions",
      message: `Your quiz has only ${hotsPct}% HOTS questions, below the ${TOS_HOTS_TARGET}% target. You need approximately ${neededHots} more higher-order thinking question(s).`,
      actionItems: [
        "Add questions that ask students to analyze relationships or compare concepts",
        "Include questions requiring evaluation of arguments or justification of decisions",
        "Create questions that ask students to design, construct, or propose solutions",
      ],
    });
  }

  if (lotsPct < TOS_LOTS_TARGET - TOLERANCE) {
    suggestions.push({
      type: "info",
      title: "LOTS Below Target",
      message: `Your quiz has only ${lotsPct}% LOTS questions, below the ${TOS_LOTS_TARGET}% target. While having more HOTS is generally positive, the TOS requires a balance for foundational knowledge assessment.`,
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
      message: `Your quiz meets the Table of Specifications requirement with ${lotsPct}% LOTS and ${hotsPct}% HOTS (target: ${TOS_LOTS_TARGET}/${TOS_HOTS_TARGET}).`,
      actionItems: [],
    });
  }

  // ── Level Distribution Suggestions ──
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
            Remembering: "Add questions that test recall of facts, definitions, or key terms",
            Understanding: "Add questions that ask students to explain, summarize, or paraphrase concepts",
            Applying: "Add questions that require students to use knowledge in new situations or solve practical problems",
            Analyzing: "Add questions that ask students to compare, contrast, categorize, or identify patterns",
            Evaluating: "Add questions that require students to judge, critique, or justify arguments",
            Creating: "Add questions that ask students to design, propose, or construct original solutions",
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

  // ── Flagged Questions ──
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

  // ── Question Count ──
  if (totalQuestions < 10) {
    suggestions.push({
      type: "info",
      title: "Small Question Pool",
      message: `Your quiz has only ${totalQuestions} questions. With a small pool, it's harder to achieve the ideal LOTS/HOTS distribution.`,
      actionItems: [
        "Consider adding more questions for a more reliable assessment",
        `Aim for at least ${Math.ceil(10 * (TOS_HOTS_TARGET / 100))} HOTS and ${Math.ceil(10 * (TOS_LOTS_TARGET / 100))} LOTS questions minimum`,
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
        className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl font-black shrink-0 ${
          compliance.isCompliant
            ? "bg-green-100 text-green-600 border-2 border-green-300"
            : "bg-red-100 text-red-600 border-2 border-red-300"
        }`}
      >
        {compliance.isCompliant ? "✓" : "!"}
      </div>
      <div className="flex-1">
        <p
          className={`font-bold text-sm ${
            compliance.isCompliant ? "text-green-700" : "text-red-700"
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
                ? "text-green-600"
                : "text-red-600"
            }`}
          >
            LOTS: {compliance.lotsPct}%{" "}
            ({compliance.lotsDeviation > 0 ? "+" : ""}
            {compliance.lotsDeviation}%)
          </span>
          <span
            className={`text-xs font-semibold ${
              Math.abs(compliance.hotsDeviation) <= TOLERANCE
                ? "text-green-600"
                : "text-red-600"
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
 * Renders AI-powered improvement suggestions based on Bloom's analysis
 */
export const QuizSuggestions = ({ summary }) => {
  const { suggestions, compliance } = generateSuggestions(summary);

  if (suggestions.length === 0) return null;

  const typeStyles = {
    success: {
      bg: "bg-green-50",
      border: "border-green-200",
      icon: "✅",
      titleColor: "text-green-800",
      textColor: "text-green-700",
      bulletColor: "text-green-500",
    },
    warning: {
      bg: "bg-amber-50",
      border: "border-amber-200",
      icon: "⚠️",
      titleColor: "text-amber-800",
      textColor: "text-amber-700",
      bulletColor: "text-amber-500",
    },
    error: {
      bg: "bg-red-50",
      border: "border-red-200",
      icon: "❌",
      titleColor: "text-red-800",
      textColor: "text-red-700",
      bulletColor: "text-red-500",
    },
    info: {
      bg: "bg-blue-50",
      border: "border-blue-200",
      icon: "💡",
      titleColor: "text-blue-800",
      textColor: "text-blue-700",
      bulletColor: "text-blue-500",
    },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-bold text-gray-800">
          Quiz Improvement Suggestions
        </h3>
        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">
          TOS: {TOS_LOTS_TARGET}/{TOS_HOTS_TARGET}
        </span>
      </div>

      {/* TOS Compliance Gauge */}
      <ComplianceGauge compliance={compliance} />

      {/* Suggestions List */}
      <div className="space-y-3">
        {suggestions.map((suggestion, idx) => {
          const style = typeStyles[suggestion.type] || typeStyles.info;
          return (
            <div
              key={idx}
              className={`p-4 rounded-lg border ${style.bg} ${style.border}`}
            >
              <div className="flex items-start gap-2">
                <span className="text-lg shrink-0">{style.icon}</span>
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
                            ▸
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
