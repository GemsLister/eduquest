import { supabase } from "../supabaseClient.js";

/**
 * Returns a Map of quizId -> number of active questions, using two batched
 * queries instead of one query per quiz. Questions can be linked directly
 * (questions.quiz_id) or through the quiz_questions junction table, so the
 * larger of the two counts is used.
 */
export const fetchQuestionCounts = async (quizIds) => {
  const ids = [...new Set((quizIds || []).filter(Boolean))];
  const counts = new Map();
  if (ids.length === 0) return counts;

  const tally = (rows) => {
    const map = new Map();
    (rows || []).forEach((r) => map.set(r.quiz_id, (map.get(r.quiz_id) || 0) + 1));
    return map;
  };

  const [{ data: directRows }, junction] = await Promise.all([
    supabase
      .from("questions")
      .select("quiz_id")
      .in("quiz_id", ids)
      .or("is_archived.is.null,is_archived.eq.false"),
    supabase.from("quiz_questions").select("quiz_id").in("quiz_id", ids),
  ]);

  const directCounts = tally(directRows);
  const junctionCounts = junction?.error ? new Map() : tally(junction?.data);

  ids.forEach((id) => {
    counts.set(id, Math.max(directCounts.get(id) || 0, junctionCounts.get(id) || 0));
  });
  return counts;
};

/**
 * Returns a Map of quizId -> attempt rows ({ id, quiz_id, section_id }) for
 * the given quizzes in a single query.
 */
export const fetchAttemptsByQuiz = async (quizIds) => {
  const ids = [...new Set((quizIds || []).filter(Boolean))];
  const byQuiz = new Map();
  if (ids.length === 0) return byQuiz;

  const { data } = await supabase
    .from("quiz_attempts")
    .select("id, quiz_id, section_id")
    .in("quiz_id", ids);

  (data || []).forEach((a) => {
    if (!byQuiz.has(a.quiz_id)) byQuiz.set(a.quiz_id, []);
    byQuiz.get(a.quiz_id).push(a);
  });
  return byQuiz;
};
