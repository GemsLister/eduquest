import { supabase } from "../../supabaseClient";
export const saveItemAnalysis = async () => {
  try {
    const results = [];

    for (const item of analysisResults) {
      // Calculate auto-flag based on difficulty status (Easy/Moderate/Difficult)
      const autoFlag = calculateAutoFlag(item.status);

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
          difficulty_index: parseFloat(item.difficulty),
          difficulty_status: item.status,
          discrimination_index: parseFloat(item.discrimination),
          discrimination_status: item.discStatus,
          total_takers: item.total,
          correct_takers: Math.round(item.total * parseFloat(item.difficulty)),
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

      // Insert distractor analysis if available
      if (item.distractorAnalysis && analysisData) {
        const distractorInserts = Object.entries(item.distractorAnalysis).map(
          ([key, value]) => ({
            item_analysis_id: analysisData.id,
            option_identifier: key,
            taker_count: value.count,
            taker_percentage: parseFloat(value.percentage),
            is_correct_answer: key === "correct",
          }),
        );

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

    // Dispatch event to notify question list to refresh
    window.dispatchEvent(new Event("questions-updated"));

    return { data: results, error: null };
  } catch (error) {
    console.error("Error in saveItemAnalysis:", error);
    return { data: null, error };
  }
};
