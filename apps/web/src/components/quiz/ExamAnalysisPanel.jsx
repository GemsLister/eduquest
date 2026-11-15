import { BLOOM_LEVELS, bloomsLevelColor, isManualLevel, levelEditorRoleLabel, modelLevelOf } from "../../utils/bloomsLevels.js";

const MAX_LISTED = 12;

const formatWhen = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

const percent = (confidence) => `${Math.round((confidence || 0) * 100)}%`;

/** Question numbers as buttons that jump to the question. */
const QuestionLinks = ({ numbers, onJump }) => {
  const shown = numbers.slice(0, MAX_LISTED);
  return (
    <span className="inline-flex flex-wrap gap-1 align-middle">
      {shown.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onJump(n)}
          aria-label={`Go to question ${n}`}
          className="px-1.5 py-0.5 rounded border border-gray-300 bg-white/80 text-xs font-bold hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
        >
          Q{n}
        </button>
      ))}
      {numbers.length > shown.length && (
        <span className="text-xs font-semibold self-center">+{numbers.length - shown.length} more</span>
      )}
    </span>
  );
};

const AnalyzeButton = ({ running, disabled, hasResults, onAnalyze }) => (
  <button
    type="button"
    onClick={onAnalyze}
    disabled={running || disabled}
    className="bg-brand-navy hover:bg-brand-indigo text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/40"
  >
    {running ? (
      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    ) : (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    )}
    {running ? "Analyzing..." : hasResults ? "Re-analyze" : "Analyze Bloom's Levels"}
  </button>
);

/**
 * Bloom's analysis summary at the top of the exam editor: LOTS/HOTS against
 * the Table of Specifications, level counts, what to change, and which
 * questions changed since the analysis. The same component is used by
 * instructors and Senior Faculty.
 */
export const ExamAnalysisSummary = ({
  editorAnalysis,
  results,
  source,
  running,
  canAnalyze,
  analyzeDisabled,
  onAnalyze,
  onJumpToQuestion,
  className = "mb-6",
}) => {
  if (!editorAnalysis) {
    if (!canAnalyze) return null;
    return (
      <section
        aria-label="Bloom's Taxonomy analysis"
        className={`${className} rounded-xl border border-dashed border-brand-navy/30 bg-brand-navy/[0.03] p-4 flex flex-wrap items-center justify-between gap-3`}
      >
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-brand-navy">Bloom&apos;s Taxonomy</h3>
          <p className="text-sm text-gray-600">
            Analyze the exam to see each question&apos;s Bloom&apos;s level here and what to change to meet the
            Table of Specifications. You can re-analyze as often as you like before submitting.
          </p>
        </div>
        <AnalyzeButton running={running} disabled={analyzeDisabled} hasResults={false} onAnalyze={onAnalyze} />
      </section>
    );
  }

  const { summary } = editorAnalysis;
  const { recommendation } = summary;
  const outdated = summary.changed.length + summary.notAnalyzed.length;

  return (
    <section
      aria-label="Bloom's Taxonomy analysis"
      className={`${className} rounded-xl border border-gray-200 bg-white p-4 sm:p-5 space-y-4`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-brand-navy">Bloom&apos;s Taxonomy</h3>
          <p className="text-xs text-gray-500">
            {source === "review" ? "Levels from the latest review" : "Analyzed"}
            {results?.analyzedAt ? ` · ${formatWhen(results.analyzedAt)}` : ""} · {summary.total} question
            {summary.total === 1 ? "" : "s"} · {summary.tosLabel} ({summary.lotsTarget}% LOTS / {summary.hotsTarget}% HOTS)
          </p>
        </div>
        {canAnalyze && (
          <AnalyzeButton running={running} disabled={analyzeDisabled} hasResults onAnalyze={onAnalyze} />
        )}
      </div>

      {/* LOTS vs HOTS with the target line */}
      <div>
        <div className="relative">
          <div className="flex h-7 rounded-lg overflow-hidden bg-gray-100" role="img" aria-label={`LOTS ${summary.lotsPercentage}%, HOTS ${summary.hotsPercentage}%`}>
            {summary.lotsPercentage > 0 && (
              <div className="bg-emerald-500 flex items-center justify-center text-white text-xs font-bold" style={{ width: `${summary.lotsPercentage}%` }}>
                {summary.lotsPercentage >= 12 && `LOTS ${summary.lotsPercentage}%`}
              </div>
            )}
            {summary.hotsPercentage > 0 && (
              <div className="bg-amber-500 flex items-center justify-center text-white text-xs font-bold" style={{ width: `${summary.hotsPercentage}%` }}>
                {summary.hotsPercentage >= 12 && `HOTS ${summary.hotsPercentage}%`}
              </div>
            )}
          </div>
          <div className="absolute -top-1 -bottom-1 border-l-2 border-dashed border-gray-800" style={{ left: `${summary.lotsTarget}%` }} title={`Target: ${summary.lotsTarget}% LOTS`} />
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {BLOOM_LEVELS.map((level) => (
            <span key={level} className={`px-2 py-0.5 rounded border text-xs font-semibold ${bloomsLevelColor(level)} ${summary.distribution[level] ? "" : "opacity-50"}`}>
              {level} {summary.distribution[level] || 0}
            </span>
          ))}
        </div>
      </div>

      {/* What to change */}
      {recommendation?.type === "raise" && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">
            {summary.lotsPercentage}% LOTS is above the {summary.lotsTarget}% target.
          </p>
          <p className="mt-0.5">
            Raise about <strong>{recommendation.count}</strong> question{recommendation.count === 1 ? "" : "s"} to a higher
            level (Analyzing, Evaluating or Creating). Lowest levels first:{" "}
            <QuestionLinks numbers={recommendation.questionNumbers} onJump={onJumpToQuestion} />
          </p>
        </div>
      )}
      {recommendation?.type === "add_lots" && (
        <div className="rounded-lg border border-sky-300 bg-sky-50 p-3 text-sm text-sky-900">
          <p className="font-semibold">
            {summary.lotsPercentage}% LOTS is below the {summary.lotsTarget}% target.
          </p>
          <p className="mt-0.5">
            The Table of Specifications also needs foundational questions: add or adjust about{" "}
            <strong>{recommendation.count}</strong> Remembering, Understanding or Applying question
            {recommendation.count === 1 ? "" : "s"}.
          </p>
        </div>
      )}
      {recommendation?.type === "compliant" && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 font-semibold">
          Meets the Table of Specifications ({summary.lotsPercentage}% LOTS / {summary.hotsPercentage}% HOTS).
        </div>
      )}

      {/* Questions whose result is missing, outdated or uncertain */}
      {(outdated > 0 || summary.lowConfidence.length > 0) && (
        <ul className="space-y-1.5 text-sm">
          {summary.changed.length > 0 && (
            <li className="text-gray-700">
              <span className="font-semibold">Edited since the analysis</span> (shown greyed out):{" "}
              <QuestionLinks numbers={summary.changed} onJump={onJumpToQuestion} />
            </li>
          )}
          {summary.notAnalyzed.length > 0 && (
            <li className="text-gray-700">
              <span className="font-semibold">Not analyzed yet:</span>{" "}
              <QuestionLinks numbers={summary.notAnalyzed} onJump={onJumpToQuestion} />
            </li>
          )}
          {summary.lowConfidence.length > 0 && (
            <li className="text-yellow-800">
              <span className="font-semibold">Low confidence, check the level:</span>{" "}
              <QuestionLinks numbers={summary.lowConfidence} onJump={onJumpToQuestion} />
            </li>
          )}
          {outdated > 0 && canAnalyze && (
            <li className="text-xs text-gray-500">Re-analyze to update these. Unchanged questions are not re-classified.</li>
          )}
        </ul>
      )}
    </section>
  );
};

/** The question's Bloom's result, shown in its header in the exam editor. */
export const QuestionAnalysisBadge = ({ entry }) => {
  if (!entry || entry.status === "blank") return null;
  const { item, status } = entry;

  if (status === "new") {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-semibold border border-dashed border-gray-300 text-gray-500 bg-white" title="Added or replaced after the last analysis. Re-analyze to classify it.">
        Not analyzed
      </span>
    );
  }

  if (status === "changed") {
    return (
      <span
        className="px-2 py-0.5 rounded-full text-xs font-semibold border border-dashed border-gray-300 text-gray-500 bg-gray-50"
        title={`Edited after the analysis, which classified it as ${item.bloomsLevel}. Re-analyze to update it.`}
      >
        <span className="line-through">{item.bloomsLevel}</span> · edited
      </span>
    );
  }

  const manual = isManualLevel(item);
  const reasons = (item.reviewReasons || []).join(" ");
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={`px-2 py-0.5 rounded-full text-xs font-bold border ${bloomsLevelColor(item.bloomsLevel)}`}
        title={
          manual
            ? `Set to ${item.bloomsLevel} by ${item.levelChangedBy?.name || "a reviewer"} (${levelEditorRoleLabel(item.levelChangedBy?.role)}). Classifier: ${modelLevelOf(item)}.${item.levelChangeReason ? ` Reason: ${item.levelChangeReason}` : ""}`
            : `Bloom's level from the AI classifier, ${percent(item.confidence)} confident.`
        }
      >
        {item.bloomsLevel}
        <span className="font-semibold opacity-75"> · {item.thinkingOrder}</span>
        <span className="font-semibold opacity-75"> · {manual ? levelEditorRoleLabel(item.levelChangedBy?.role) : percent(item.confidence)}</span>
      </span>
      {item.needsReview && !manual && (
        <span
          className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-300"
          title={`Low confidence. ${reasons || "Check that this level is right."}`}
          aria-label="Low confidence"
        >
          !
        </span>
      )}
    </span>
  );
};
