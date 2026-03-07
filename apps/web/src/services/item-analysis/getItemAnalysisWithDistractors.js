import { supabase } from "../../supabaseClient";
export const getItemAnalysisWithDistractors = async (quizId) => {
  try {
    // Get item analysis
    const { data: itemAnalysis, error: analysisError } = await supabase
      .from("item_analysis")
      .select("*")
      .eq("quiz_id", quizId)
      .order("created_at", { ascending: false });

    if (analysisError) throw analysisError;

    if (!itemAnalysis || itemAnalysis.length === 0) {
      return { data: [], error: null };
    }

    // Get distractors for all items
    const itemIds = itemAnalysis.map((item) => item.id);
    const { data: distractors, error: distractorError } = await supabase
      .from("item_distractor_analysis")
      .select("*")
      .in("item_analysis_id", itemIds)
      .order("taker_count", { ascending: false });

    if (distractorError) throw distractorError;

    // Combine data
    const results = itemAnalysis.map((item) => ({
      ...item,
      distractors: distractors
        ? distractors.filter((d) => d.item_analysis_id === item.id)
        : [],
    }));

    return { data: results, error: null };
  } catch (error) {
    console.error("Error fetching item analysis with distractors:", error);
    return { data: null, error };
  }
};
