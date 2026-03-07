import { supabase } from "../../supabaseClient";

export const hasItemAnalysis = async (quizId) => {
  try {
    const { count, error } = await supabase
      .from("item_analysis")
      .select("*", { count: "exact", head: true })
      .eq("quiz_id", quizId);

    if (error) throw error;
    return count > 0;
  } catch (error) {
    console.error("Error checking item analysis existence:", error);
    return false;
  }
};
