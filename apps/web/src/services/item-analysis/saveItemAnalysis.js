import { supabase } from "../../supabaseClient";
import { logAudit } from "../auditService.js";

/**
 * Convert the decision shown on the Item Analysis page (which uses both
 * Difficulty P and Discrimination D) into the stored flag, so the saved
 * flag always matches what the instructor saw.
 *   approved -> approved        (0.25 <= P <= 0.75 and D >= 0.30)
 *   revise   -> needs_revision
 *   reject   -> discard         (P = 0, P = 1, or D < 0.20)
 * @param {string} pageFlag - item.autoFlag from the Item Analysis page
 * @returns {string} - "approved", "needs_revision", "discard", or "pending"
 */
const toStoredFlag = (pageFlag) => {
  switch ((pageFlag || "").toString().trim().toLowerCase()) {
    case "approved":
    case "retain":
      return "approved";
    case "revise":
    case "needs_revision":
      return "needs_revision";
    case "reject":
    case "discard":
      return "discard";
    default:
      return "pending";
  }
};

const normalizeDifficultyStatus = (status) => {
  const value = (status || "").toString().trim().toLowerCase();
  if (value === "easy") return "Easy";
  if (value === "moderate") return "Moderate";
  if (value === "difficult") return "Difficult";
  return null;
};

// The item_analysis table only accepts Excellent / Good / Acceptable / Poor.
// The page's "Marginal" (D 0.20-0.29) is stored as Acceptable and "Flawed"
// (D < 0) as Poor; the exact D value is saved in discrimination_index.
const normalizeDiscriminationStatus = (status) => {
  const value = (status || "").toString().trim().toLowerCase();
  if (value === "excellent") return "Excellent";
  if (value === "good") return "Good";
  if (value === "acceptable" || value === "marginal") return "Acceptable";
  if (value === "poor" || value === "flawed") return "Poor";
  return null;
};

const toFiniteOrNull = (value) => {
  const num = Number(value);
  return value !== null && value !== "" && Number.isFinite(num) ? num : null;
};

/**
 * Save item analysis results for a quiz
 * @param {string} quizId - Quiz ID
 * @param {Array} analysisResults - Array of analysis results
 * @returns {Promise<{data, error}>}
 */
export const saveItemAnalysis = async (quizId, analysisResults) => {
  try {
    const results = [];

    for (const item of analysisResults) {
      const totalTakers = toFiniteOrNull(item.totalResponses);
      const hasResponses = totalTakers !== null && totalTakers > 0;

      const normalizedDifficultyStatus = hasResponses
        ? normalizeDifficultyStatus(item.status)
        : null;
      const normalizedDiscriminationStatus = normalizeDiscriminationStatus(
        item.discStatus,
      );

      // Use the same decision the page shows (based on both P and D)
      const autoFlag = toStoredFlag(item.autoFlag);

      // First, try to delete existing analysis for this question
      await supabase
        .from("item_analysis")
        .delete()
        .eq("quiz_id", quizId)
        .eq("question_id", item.question_id);

      // Insert item analysis
      const { data: analysisData, error: analysisError } = await supabase
        .from("item_analysis")
        .insert({
          quiz_id: quizId,
          question_id: item.question_id,
          difficulty_index: hasResponses
            ? toFiniteOrNull(parseFloat(item.difficulty))
            : null,
          difficulty_status: normalizedDifficultyStatus,
          discrimination_index: toFiniteOrNull(parseFloat(item.discrimination)),
          discrimination_status: normalizedDiscriminationStatus,
          // The page names these fields totalResponses / correctCount
          total_takers: totalTakers,
          correct_takers: toFiniteOrNull(item.correctCount),
          auto_flag: autoFlag,
        })
        .select()
        .single();

      if (analysisError) {
        console.error(
          "Error saving item analysis for question:",
          item.question_id,
          analysisError,
        );
        continue;
      }

      // Update the question's flag based on analysis
      const { error: flagError } = await supabase
        .from("questions")
        .update({
          flag: autoFlag,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.question_id);

      if (flagError) {
        console.error(
          "Error updating question flag:",
          item.question_id,
          flagError,
        );
      }

      // Insert distractor analysis: one row per option, labeled A, B, C...
      // (option_identifier holds at most 10 characters, so the letter is
      // stored rather than the option text).
      if (Array.isArray(item.distractorAnalysis) && analysisData) {
        const distractorInserts = item.distractorAnalysis.map((option, idx) => ({
          item_analysis_id: analysisData.id,
          option_identifier: String.fromCharCode(65 + idx),
          taker_count: Number(option.count) || 0,
          taker_percentage: toFiniteOrNull(parseFloat(option.percentage)) ?? 0,
          is_correct_answer: option.isCorrect === true,
        }));

        if (distractorInserts.length > 0) {
          const { error: distractorError } = await supabase
            .from("item_distractor_analysis")
            .insert(distractorInserts);

          if (distractorError) {
            console.error("Error saving distractors:", distractorError);
          }
        }
      }

      results.push({
        questionId: item.question_id,
        id: analysisData?.id,
        autoFlag: autoFlag,
      });
    }

    // Item analysis is stored in item_analysis only. It must not touch the
    // quiz's review submission: overwriting it reset approved quizzes to
    // "pending" and erased the reviewer's feedback.

    // Dispatch event to notify question list to refresh
    window.dispatchEvent(new Event("questions-updated"));

    // Fetch quiz metadata for rich audit logging
    let quizTitle = "Exam Item Analysis";
    let subjectName = null;
    let sectionName = null;

    try {
      const { data: quizInfo } = await supabase
        .from("quizzes")
        .select("title, subjects(name, code), sections(name, code)")
        .eq("id", quizId)
        .single();

      if (quizInfo) {
        quizTitle = quizInfo.title || quizTitle;
        subjectName = quizInfo.subjects?.name || (quizInfo.subjects?.code ? quizInfo.subjects.code : null);
        sectionName = quizInfo.sections?.name || (quizInfo.sections?.code ? quizInfo.sections.code : null);
      }
    } catch (qErr) {
      console.warn("Could not fetch quiz info for audit log:", qErr);
    }

    // Log the audit event
    await logAudit({
      action: "ANALYSIS_SAVED",
      tableName: "item_analysis",
      recordId: quizId,
      itemName: quizTitle,
      subjectName,
      sectionName,
      newValues: { quizId, quizTitle, count: results.length },
    });

    return { data: results, error: null };
  } catch (error) {
    console.error("Error in saveItemAnalysis:", error);
    return { data: null, error };
  }
};
