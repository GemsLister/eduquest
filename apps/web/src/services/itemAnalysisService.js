import { supabase } from "../supabaseClient.js";
import { saveItemAnalysis as persistItemAnalysis } from "./item-analysis/saveItemAnalysis";

export const itemAnalysisService = {
  saveItemAnalysis: async (quizId, analysis) => {
    return await persistItemAnalysis(quizId, analysis);
  },
};
