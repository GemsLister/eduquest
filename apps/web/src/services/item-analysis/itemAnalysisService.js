// Re-export all item analysis service functions
export { fetchProfiles } from "./fetchProfiles";
export { calculateAutoFlag } from "./calculateAutoFlag";
export { getItemAnalysis } from "./getItemAnalysis";
export { getItemAnalysisWithDistractors } from "./getItemAnalysisWithDistractors";
export { hasItemAnalysis } from "./hasItemAnalysis";
export { saveItemAnalysis } from "./saveItemAnalysis";
export { deleteItemAnalysis } from "./deletedItemAnalysis";
export { getQuizResponse } from "./getQuizResponse";
export { getQuizAttempts } from "./getQuizAttempts";
export { getInstructorsSection } from "./getInstructorsSection";
export { getQuizzes } from "./getQuizzes";
export { updateQuestionFlag } from "./updateQuestionFlag";

// Sync analysis data to database
import { supabase } from "../../supabaseClient";

export const syncAnalysisToDatabase = async (analysisData, quizId) => {
  try {
    const analysisRows = analysisData.map((item) => ({
      quiz_id: quizId,
      question_id: item.question_id,
      difficulty_index: parseFloat(item.difficulty),
      difficulty_status: item.status,
      discrimination_index: parseFloat(item.discrimination),
      discrimination_status: item.discStatus,
      total_takers: item.takersDetails.length,
      auto_flag: item.autoFlag || 'pending',
    }));

    const { error: mainError } = await supabase
      .from("item_analysis")
      .upsert(analysisRows, { onConflict: "quiz_id,question_id" });
    
    if (mainError) {
      console.error("Error upserting item_analysis:", mainError);
      throw mainError;
    }

    const distRows = [];
    analysisData.forEach(item => {
      item.distractorAnalysis?.forEach(d => {
        distRows.push({
          question_id: item.question_id,
          option_identifier: d.text || String(d.index),
          taker_count: d.count || 0,
          taker_percentage: parseFloat(d.percentage) || 0,
          is_correct_answer: d.isCorrect || false
        });
      });
    });

    if (distRows.length > 0) {
      const { error: distError } = await supabase
        .from("item_distractor_analysis")
        .upsert(distRows, { onConflict: "question_id,option_identifier" });
      
      if (distError) {
        console.error("Error upserting distractor analysis:", distError);
        throw distError;
      }
    }

    return { success: true };
  } catch (e) { 
    console.error("Error in syncAnalysisToDatabase:", e);
    return { success: false, error: e }; 
  }
};
