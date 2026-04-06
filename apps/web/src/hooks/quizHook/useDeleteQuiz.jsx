import { useState } from "react";
import { notify } from "../../utils/notify.jsx";
import { useConfirm } from "../../components/ui/ConfirmModal.jsx";
import { supabase } from "../../supabaseClient";

export const useDeleteQuiz = (fetchQuizzes) => {
  const [deletingQuizId, setDeletingQuizId] = useState(null);
  const confirm = useConfirm();

  const handleDeleteQuiz = async (quizId, quizTitle) => {
    const confirmed = await confirm({
      title: "Delete Quiz",
      message: `Are you sure you want to delete "${quizTitle}"? This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
    });

    if (!confirmed) return;

    setDeletingQuizId(quizId);

    try {
      const { error: questionsError } = await supabase
        .from("questions")
        .delete()
        .eq("quiz_id", quizId);

      if (questionsError) {
        throw new Error(
          `Failed to delete questions: ${questionsError.message}`,
        );
      }

      const { error: quizError } = await supabase
        .from("quizzes")
        .delete()
        .eq("id", quizId);

      if (quizError) {
        throw new Error(`Failed to delete quiz: ${quizError.message}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 1500));
      await fetchQuizzes();

      notify.success("Quiz deleted successfully!");
    } catch (error) {
      console.error("Error deleting quiz:", error);
      notify.error("Error deleting quiz: " + error.message);
    } finally {
      setDeletingQuizId(null);
    }
  };

  return { handleDeleteQuiz, deletingQuizId };
};
