import { supabase } from "../../supabaseClient";

/**
 * Update the flag status of a question
 * @param {string} questionId - Question ID
 * @param {string} flag - New flag value ('pending', 'approved', 'needs_revision', 'discard')
 * @returns {Promise<{data, error}>}
 */
export const updateQuestionFlag = async (questionId, flag) => {
  try {
    const { data, error } = await supabase
      .from("questions")
      .update({ 
        flag: flag,
        updated_at: new Date().toISOString()
      })
      .eq("id", questionId)
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    console.error("Error updating question flag:", error);
    return { data: null, error };
  }
};
