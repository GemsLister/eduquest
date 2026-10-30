/**
 * Bloom's levels in an exam analysis, including levels a person corrected.
 *
 * Each analysis item keeps the classifier's answer next to the final one:
 * - bloomsLevel / thinkingOrder: the final level, used by summaries and charts
 * - modelBloomsLevel / modelConfidence: the classifier's level, never changed
 *   (only stored once someone edits the item; before that, bloomsLevel is it)
 * - levelSource: "manual" when a person set the final level
 * - levelChangedBy / levelChangeReason / levelChangedAt: the latest manual change
 * - levelHistory: every change, including reverts, as { from, to, by, reason, at }
 * `confidence` always stays the classifier's confidence.
 */

export const BLOOM_LEVELS = ["Remembering", "Understanding", "Applying", "Analyzing", "Evaluating", "Creating"];

const LOTS_LEVELS = new Set(["Remembering", "Understanding", "Applying"]);

export const thinkingOrderOf = (level) => (LOTS_LEVELS.has(level) ? "LOTS" : "HOTS");

// Roles that can change a level, keyed the way they are stored in levelChangedBy.role
export const LEVEL_EDITOR_ROLES = {
  instructor: "Instructor",
  peer_reviewer: "Peer Reviewer",
  senior_faculty: "Senior Faculty",
  department_head: "Department Head",
};

export const levelEditorRoleLabel = (role) => LEVEL_EDITOR_ROLES[role] || "Reviewer";

// Same palette as the analysis tables
const LEVEL_COLORS = {
  Remembering: "bg-blue-100 text-blue-700 border-blue-300",
  Understanding: "bg-cyan-100 text-cyan-700 border-cyan-300",
  Applying: "bg-green-100 text-green-700 border-green-300",
  Analyzing: "bg-yellow-100 text-yellow-700 border-yellow-300",
  Evaluating: "bg-orange-100 text-orange-700 border-orange-300",
  Creating: "bg-purple-100 text-purple-700 border-purple-300",
};

export const bloomsLevelColor = (level) => LEVEL_COLORS[level] || "bg-gray-100 text-gray-700 border-gray-300";

export const isManualLevel = (item) => item?.levelSource === "manual";
export const modelLevelOf = (item) => item?.modelBloomsLevel || item?.bloomsLevel;
export const modelConfidenceOf = (item) => item?.modelConfidence ?? item?.confidence;

const round1 = (n) => Math.round(n * 10) / 10;

/** Summary counts for an analysis list, keeping any other summary fields. */
export const summarizeAnalysis = (analysis, previousSummary = {}) => {
  const distribution = Object.fromEntries(BLOOM_LEVELS.map((level) => [level, 0]));
  analysis.forEach((item) => {
    distribution[item.bloomsLevel] = (distribution[item.bloomsLevel] || 0) + 1;
  });
  const total = analysis.length;
  const lotsCount = analysis.filter((item) => item.thinkingOrder === "LOTS").length;
  const hotsCount = total - lotsCount;
  return {
    ...previousSummary,
    totalQuestions: total,
    distribution,
    lotsCount,
    hotsCount,
    lotsPercentage: total > 0 ? round1((lotsCount / total) * 100) : 0,
    hotsPercentage: total > 0 ? round1((hotsCount / total) * 100) : 0,
    flaggedCount: analysis.filter((item) => item.needsReview).length,
  };
};

/**
 * Returns new analysis results with one question's level changed and the
 * summary recalculated. Choosing the classifier's own level reverts the
 * question to it. `editor` is { id, name, role }.
 */
export const changeQuestionLevel = (results, questionId, newLevel, { editor, reason = "" }) => {
  if (!BLOOM_LEVELS.includes(newLevel)) throw new Error(`Unknown Bloom's level: ${newLevel}`);
  const now = new Date().toISOString();
  const cleanReason = reason.trim() || null;

  const analysis = (results.analysis || []).map((item) => {
    if (String(item.questionId) !== String(questionId)) return item;
    const modelLevel = modelLevelOf(item);
    const modelNeedsReview = item.modelNeedsReview ?? item.needsReview ?? false;
    const backToModel = newLevel === modelLevel;
    return {
      ...item,
      modelBloomsLevel: modelLevel,
      modelThinkingOrder: item.modelThinkingOrder || thinkingOrderOf(modelLevel),
      modelConfidence: modelConfidenceOf(item),
      modelNeedsReview,
      bloomsLevel: newLevel,
      thinkingOrder: thinkingOrderOf(newLevel),
      levelSource: backToModel ? "model" : "manual",
      levelChangedBy: backToModel ? null : editor,
      levelChangeReason: backToModel ? null : cleanReason,
      levelChangedAt: backToModel ? null : now,
      // A person decided the level, so it no longer needs review
      needsReview: backToModel ? modelNeedsReview : false,
      levelHistory: [
        ...(item.levelHistory || []),
        { from: item.bloomsLevel, to: newLevel, by: editor, reason: cleanReason, at: now },
      ],
    };
  });

  return { ...results, analysis, summary: summarizeAnalysis(analysis, results.summary) };
};

/** { total, byRole: { instructor: 2, ... } } for questions whose final level was set manually. */
export const manualLevelStats = (results) => {
  const manual = (results?.analysis || []).filter(isManualLevel);
  const byRole = {};
  manual.forEach((item) => {
    const role = item.levelChangedBy?.role || "unknown";
    byRole[role] = (byRole[role] || 0) + 1;
  });
  return { total: manual.length, byRole };
};
