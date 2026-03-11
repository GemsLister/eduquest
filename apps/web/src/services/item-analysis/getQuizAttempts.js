import { supabase } from "../../supabaseClient";

/**
 * Get all quiz attempts for a quiz
 * @param {string} quizId - Quiz ID
 * @returns {Promise<{data, error}>}
 */
export const getQuizAttempts = async (quizId) => {
  try {
    const { data, error } = await supabase
      .from("quiz_attempts")
      .select("id, score, user_id, guest_name")
      .eq("quiz_id", quizId);

    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error) {
    console.error("Error fetching quiz attempts:", error);
    return { data: null, error };
  }
};
