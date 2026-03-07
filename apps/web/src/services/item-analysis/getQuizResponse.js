import { supabase } from "../../supabaseClient";
export const getQuizResponse = async (questionIds) => {
  try {
    const { data, error } = await supabase
      .from("quiz_responses")
      .select("id, question_id, is_correct, attempt_id, answer")
      .in("question_id", questionIds);
    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error) {
    console.error("Error:", error);
    return { data: null, error };
  }
};
