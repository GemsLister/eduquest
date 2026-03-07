import { supabase } from "../../supabaseClient";

export const useDeleteQuestion = () => {
  const handleDeleteQuestion = async (id) => {
    if (confirm("Are you sure you want to delete this question? This will also remove all student attempts for this quiz.")) {
      try {
        // First, get all quiz_responses for this question
        const { data: responses, error: responsesError } = await supabase
          .from("quiz_responses")
          .select("attempt_id")
          .eq("question_id", id);

        if (responsesError) {
          console.error("Error fetching responses:", responsesError);
          alert("Failed to delete question: " + responsesError.message);
          return;
        }

        // Get unique attempt IDs
        const attemptIds = [...new Set(responses?.map(r => r.attempt_id).filter(Boolean))];

        // Delete quiz_responses for this question first
        const { error: deleteResponsesError } = await supabase
          .from("quiz_responses")
          .delete()
          .eq("question_id", id);

        if (deleteResponsesError) {
          console.error("Error deleting responses:", deleteResponsesError);
          alert("Failed to delete question responses: " + deleteResponsesError.message);
          return;
        }

        // Delete quiz_attempts that had responses to this question
        if (attemptIds.length > 0) {
          const { error: deleteAttemptsError } = await supabase
            .from("quiz_attempts")
            .delete()
            .in("id", attemptIds);

          if (deleteAttemptsError) {
            console.error("Error deleting attempts:", deleteAttemptsError);
            // Continue anyway - the question should still be deleted
          }
        }

        // Finally, delete the question
        const { error: deleteQuestionError } = await supabase
          .from("questions")
          .delete()
          .eq("id", id);

        if (deleteQuestionError) {
          console.error("Error deleting question:", deleteQuestionError);
          alert("Failed to delete question: " + deleteQuestionError.message);
          return;
        }

        // Dispatch event to notify other components to refresh
        window.dispatchEvent(new Event('questions-updated'));
        
        alert("Question and related student attempts deleted successfully!");
      } catch (error) {
        console.error("Error deleting question:", error);
        alert("An error occurred while deleting the question");
      }
    }
  };

  return { handleDeleteQuestion };
};
