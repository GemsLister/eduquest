import { useState } from "react";
import * as ItemAnalysisService from "../../services/item-analysis/itemAnalysisService";
import { useItemDifficulty } from "./useItemDifficulty";
import { useDiscrimination } from "./useDiscrimination";
import { useDistractor } from "./useDistractor";

export const useFetchAnalyze = () => {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState([]);

  const { handleItemDifficulty } = useItemDifficulty();
  const { handleDiscrimination } = useDiscrimination();
  const { handleDistractor } = useDistractor();

  const fetchAndAnalyze = async (quizId) => {
    if (!quizId) return;
    try {
      setLoading(true);
      const { data: questions } =
        await ItemAnalysisService.getItemAnalysis(quizId);
      const { data: attempts } =
        await ItemAnalysisService.getQuizAttempts(quizId);
      const { data: responses } = await ItemAnalysisService.getQuizResponse(
        questions.map((q) => q.id),
      );

      const takersMap = {};
      attempts?.forEach((att) => {
        takersMap[att.id] = {
          name: att.guest_name || "Student",
          score: att.score || 0,
        };
      });

      const results = questions.map((question) => {
        // 1. Fixed variable name consistency
        const questionResponse =
          responses?.filter((res) => res.question_id === question.id) || [];

        // 2. Used 'questionResponse' instead of 'qRes' and 'question' instead of 'q'
        const difficulty = handleItemDifficulty(
          questionResponse.length > 0,
          questionResponse.filter((r) => r.is_correct).length,
          questionResponse.length,
        );
        const disc = handleDiscrimination(questionResponse, takersMap);
        const distractors = handleDistractor(question, questionResponse);

        return {
          question_id: question.id,
          text: question.question_text || question.text,
          difficulty: difficulty.fi,
          status: difficulty.status,
          autoFlag: difficulty.action,
          discrimination: disc.discrimination,
          discStatus: disc.discStatus,
          distractorAnalysis: distractors,
          takersDetails: questionResponse.map((response) => ({
            // 3. Changed 'r.attempt_id' to 'response.attempt_id'
            name: takersMap[response.attempt_id]?.name || "Anonymous",
            answer: question.options
              ? question.options[parseInt(response.answer)]
              : response.answer,
            isCorrect: response.is_correct,
          })),
        };
      });
      setAnalysis(results);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return { fetchAndAnalyze, loading, analysis };
};
