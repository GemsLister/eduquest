import { supabase } from "../supabaseClient.js";

// Exam results in one request each (see the 20261113_exam_results_in_one_request
// migration). Before, attempts were capped at 1,000 rows and answers were
// requested with every attempt id in the URL, which fails at ~1,000 students.

/**
 * All attempts of the given exam versions, newest first.
 * Each item is a full quiz_attempts row (same shape as select("*")).
 */
export async function fetchExamAttempts({ quizIds, sectionId = null, completedOnly = false }) {
  const { data, error } = await supabase.rpc("get_exam_attempts", {
    p_quiz_ids: quizIds,
    p_section_id: sectionId || null,
    p_completed_only: completedOnly,
  });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

/**
 * All saved answers of the given attempts, in the order they were saved.
 * Returns rows shaped like quiz_responses:
 *   { attempt_id, question_id, answer, is_correct, points_earned, time_spent_seconds }
 */
export async function fetchExamResponses(attemptIds) {
  if (!attemptIds || attemptIds.length === 0) return [];
  const { data, error } = await supabase.rpc("get_exam_responses", {
    p_attempt_ids: attemptIds,
  });
  if (error) throw error;

  // The server packs answers as [question index, answer, is_correct, points, seconds]
  const questionIds = data?.q || [];
  const rows = [];
  for (const [attemptId, items] of Object.entries(data?.r || {})) {
    for (const [qi, answer, isCorrect, points, seconds] of items) {
      rows.push({
        attempt_id: attemptId,
        question_id: questionIds[qi],
        answer,
        is_correct: isCorrect,
        points_earned: points,
        time_spent_seconds: seconds,
      });
    }
  }
  return rows;
}
