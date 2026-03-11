import { supabase } from "../../supabaseClient";

/**
 * Delete item analysis for a quiz
 * @param {string} quizId - Quiz ID
 * @returns {Promise<{error}>}
 */
export const deleteItemAnalysis = async (quizId) => {
  try {
    // Distractors will be deleted automatically due to CASCADE
    const { error } = await supabase
      .from("item_analysis")
      .delete()
      .eq("quiz_id", quizId);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error("Error deleting item analysis:", error);
    return { error };
  }
};
