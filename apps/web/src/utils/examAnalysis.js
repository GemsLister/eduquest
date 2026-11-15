/**
 * Bloom's analysis of an exam, as used by the exam editor and the
 * "Submit for Review" dialog.
 *
 * The classifier only sees a question's text and (for MCQs) its choices, so a
 * question's "fingerprint" is exactly that. Every analysis item stores the
 * fingerprint it was made from; comparing it with the question as it is now
 * tells the editor whether the result still applies or the question has been
 * edited since.
 */
import { analyzeQuiz } from "../services/quizAnalysisService";
import { analyzeGADQuestion } from "../services/gadAnalysisService";
import { BLOOM_LEVELS, isManualLevel, summarizeAnalysis, thinkingOrderOf } from "./bloomsLevels";

// Table of Specifications targets (same as the analysis dialog's suggestions)
export const TOS_MODES = {
  standard: { lotsTarget: 30, hotsTarget: 70, label: "Standard TOS" },
  project: { lotsTarget: 20, hotsTarget: 80, label: "Project-Based" },
};
export const TOS_TOLERANCE = 5; // percentage points before flagging

const normalize = (text) =>
  String(text ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const round1 = (n) => Math.round(n * 10) / 10;

/** The choices the classifier sees: MCQ option texts; other types send none. */
export const choicesForAnalysis = (question) =>
  question.type === "mcq" && Array.isArray(question.options)
    ? question.options.filter((opt) => typeof opt === "string" && opt.trim())
    : null;

export const questionFingerprint = (text, choices) =>
  [normalize(text), ...(choices || []).map(normalize)].join("\u001f");

export const fingerprintOfQuestion = (question) =>
  questionFingerprint(question.text, choicesForAnalysis(question));

/**
 * The fingerprint an analysis item was made from. Analyses saved before
 * fingerprints existed (older submissions) are rebuilt from the item's text
 * and the submission's question snapshot.
 */
export const itemFingerprint = (results, item) => {
  if (item.fingerprint) return item.fingerprint;
  const snapshot = (results?.questionSnapshots || []).find(
    (s) => String(s.questionId) === String(item.questionId),
  );
  const choices = snapshot?.type === "mcq" ? snapshot.options : null;
  return questionFingerprint(item.questionText, choices);
};

export const questionsForApi = (questions) =>
  questions.map((q) => ({ id: String(q.id), text: q.text, choices: choicesForAnalysis(q) }));

/**
 * Keeps levels a person set (instructor or reviewer) on questions that have
 * not changed since, so re-analyzing never silently undoes a reviewer's
 * correction. Edited questions get the classifier's new level.
 */
export const carryManualLevels = (results, previous) => {
  if (!previous?.analysis?.length) return results;
  const manualByFingerprint = new Map(
    previous.analysis.filter(isManualLevel).map((item) => [itemFingerprint(previous, item), item]),
  );
  if (manualByFingerprint.size === 0) return results;

  const analysis = results.analysis.map((item) => {
    const manual = manualByFingerprint.get(item.fingerprint);
    if (!manual || manual.bloomsLevel === item.bloomsLevel) return item;
    return {
      ...item,
      modelBloomsLevel: item.bloomsLevel,
      modelThinkingOrder: item.thinkingOrder,
      modelConfidence: item.confidence,
      modelNeedsReview: item.needsReview,
      bloomsLevel: manual.bloomsLevel,
      thinkingOrder: thinkingOrderOf(manual.bloomsLevel),
      levelSource: "manual",
      levelChangedBy: manual.levelChangedBy || null,
      levelChangeReason: manual.levelChangeReason || null,
      levelChangedAt: manual.levelChangedAt || null,
      needsReview: false,
      levelHistory: manual.levelHistory || [],
    };
  });
  return { ...results, analysis, summary: summarizeAnalysis(analysis, results.summary) };
};

/**
 * Runs the Bloom's classifier on the exam's questions (blank ones skipped)
 * and returns the analysis with each item's fingerprint, the GAD check, and
 * manual levels carried over from `previous`.
 */
export const runExamAnalysis = async (quizId, questions, { onBusy, previous } = {}) => {
  const toAnalyze = questions.filter((q) => (q.text || "").trim());
  if (toAnalyze.length === 0) throw new Error("No questions to analyze.");

  const data = await analyzeQuiz(quizId || "draft", questionsForApi(toAnalyze), { onBusy });
  const byId = new Map(toAnalyze.map((q) => [String(q.id), q]));

  const withFingerprints = {
    ...data,
    analysis: (data.analysis || []).map((item, i) => {
      const question = byId.get(String(item.questionId)) || toAnalyze[i];
      return { ...item, fingerprint: question ? fingerprintOfQuestion(question) : itemFingerprint(data, item) };
    }),
    gadAnalysis: toAnalyze.map((q) => {
      const { isGad, matchReason } = analyzeGADQuestion(q.text, q.options);
      return { questionId: String(q.id), isGad: isGad || !!q.is_gad, matchReason };
    }),
    analyzedAt: new Date().toISOString(),
  };
  return carryManualLevels(withFingerprints, previous);
};

/**
 * Matches the latest analysis to the questions as they are now.
 *
 * Returns, per question (same order as `questions`):
 *   { item, status } with status
 *     "current" - analyzed exactly as it is now
 *     "changed" - edited since it was analyzed (item = the old result)
 *     "new"     - not analyzed yet
 *     "blank"   - no text yet
 * and `summary`: level counts, LOTS/HOTS, and what to change to meet the
 * Table of Specifications. Returns null when there is no analysis.
 */
export const buildEditorAnalysis = (results, questions, tosMode = "standard") => {
  if (!results?.analysis?.length) return null;

  const items = results.analysis.map((item) => ({ item, fp: itemFingerprint(results, item) }));
  const byFingerprint = new Map();
  items.forEach((e) => {
    if (!byFingerprint.has(e.fp)) byFingerprint.set(e.fp, e.item);
  });
  const byId = new Map(items.map((e) => [String(e.item.questionId), e.item]));
  const currentFingerprints = new Set(questions.map(fingerprintOfQuestion));

  const perQuestion = questions.map((question, i) => {
    if (!(question.text || "").trim()) return { item: null, status: "blank" };
    const current = byFingerprint.get(fingerprintOfQuestion(question));
    if (current) return { item: current, status: "current" };
    const sameId = byId.get(String(question.id));
    if (sameId) return { item: sameId, status: "changed" };
    // Revision copies give questions new ids: fall back to the same position,
    // unless that result belongs to another question that is still unchanged
    const atPosition = items[i];
    if (atPosition && !currentFingerprints.has(atPosition.fp)) {
      return { item: atPosition.item, status: "changed" };
    }
    return { item: null, status: "new" };
  });

  return { perQuestion, summary: summarizeEditorAnalysis(perQuestion, tosMode) };
};

/**
 * The latest analysis re-keyed to the questions as they are now, for
 * submitting without running the classifier again. Returns null unless every
 * question was analyzed exactly as it is now (and nothing removed is left
 * over). Items take the questions' current ids, which reviewer comments and
 * the level sync use.
 */
export const alignResultsToQuestions = (results, questions) => {
  const toSubmit = questions.filter((q) => (q.text || "").trim());
  if (!toSubmit.length || results?.analysis?.length !== toSubmit.length) return null;
  const built = buildEditorAnalysis(results, toSubmit);
  if (!built || built.perQuestion.some((e) => e.status !== "current")) return null;
  if (new Set(built.perQuestion.map((e) => e.item)).size !== toSubmit.length) return null;

  const analysis = built.perQuestion.map((e, i) => ({
    ...e.item,
    questionId: String(toSubmit[i].id),
    questionText: toSubmit[i].text,
  }));
  return {
    ...results,
    analysis,
    summary: summarizeAnalysis(analysis, results.summary),
    gadAnalysis: toSubmit.map((q) => {
      const { isGad, matchReason } = analyzeGADQuestion(q.text, q.options);
      return { questionId: String(q.id), isGad: isGad || !!q.is_gad, matchReason };
    }),
  };
};

const summarizeEditorAnalysis = (perQuestion, tosMode) => {
  const { lotsTarget, hotsTarget, label } = TOS_MODES[tosMode] || TOS_MODES.standard;
  const numbered = perQuestion.map((entry, i) => ({ ...entry, number: i + 1 }));
  const withLevel = numbered.filter((e) => e.item);

  const distribution = Object.fromEntries(BLOOM_LEVELS.map((level) => [level, 0]));
  withLevel.forEach((e) => {
    distribution[e.item.bloomsLevel] = (distribution[e.item.bloomsLevel] || 0) + 1;
  });
  const total = withLevel.length;
  const lots = withLevel.filter((e) => thinkingOrderOf(e.item.bloomsLevel) === "LOTS");
  const lotsPercentage = total ? round1((lots.length / total) * 100) : 0;
  const hotsPercentage = total ? round1(100 - lotsPercentage) : 0;

  // Lowest levels first: those are the easiest to raise
  const levelRank = (e) => BLOOM_LEVELS.indexOf(e.item.bloomsLevel);
  let recommendation;
  if (!total) {
    recommendation = null;
  } else if (lotsPercentage > lotsTarget + TOS_TOLERANCE) {
    const count = Math.max(1, Math.round(((lotsPercentage - lotsTarget) / 100) * total));
    recommendation = {
      type: "raise",
      count,
      questionNumbers: [...lots].sort((a, b) => levelRank(a) - levelRank(b) || a.number - b.number)
        .slice(0, count)
        .map((e) => e.number),
    };
  } else if (lotsPercentage < lotsTarget - TOS_TOLERANCE) {
    const count = Math.max(1, Math.round(((lotsTarget - lotsPercentage) / 100) * total));
    recommendation = { type: "add_lots", count, questionNumbers: [] };
  } else {
    recommendation = { type: "compliant", count: 0, questionNumbers: [] };
  }

  const numbersWith = (predicate) => numbered.filter(predicate).map((e) => e.number);
  return {
    total,
    distribution,
    lotsCount: lots.length,
    hotsCount: total - lots.length,
    lotsPercentage,
    hotsPercentage,
    lotsTarget,
    hotsTarget,
    tosLabel: label,
    recommendation,
    changed: numbersWith((e) => e.status === "changed"),
    notAnalyzed: numbersWith((e) => e.status === "new"),
    lowConfidence: numbersWith((e) => e.status === "current" && e.item?.needsReview),
  };
};
