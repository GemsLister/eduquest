import { supabase } from "../../supabaseClient";
export const getItemAnalysis = async (quizId) => {
  try {
    const { data, error } = await supabase
      .from("item_analysis")
      .select("*")
      .eq("quiz_id", quizId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error) {
    console.error("Error fetching item analysis:", error);
    return { data: null, error };
  }
};
