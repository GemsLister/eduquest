import { useState } from "react";
import { supabase } from "../supabaseClient";
export const useDeleteQuiz = (fetchQuizzes) => {
  const [deletingQuizId, setDeletingQuizId] = useState(null);
  const handleDeleteQuiz = async (quizId, quizTitle) => {
    if (
      !window.confirm(
        `Are you sure you want to delete "${quizTitle}"? This action cannot be undone.`,
      )
    ) {
      return;
    }

    setDeletingQuizId(quizId);
    console.log("Starting delete for quiz:", quizId, quizTitle);

    try {
      // Delete all questions associated with the quiz first
      console.log("Deleting questions for quiz:", quizId);
      const { error: questionsError } = await supabase
        .from("questions")
        .delete()
        .eq("quiz_id", quizId);

      console.log("Questions delete response - error:", questionsError);

      if (questionsError) {
        console.error("Questions delete error:", questionsError);
        throw new Error(
          `Failed to delete questions: ${questionsError.message}`,
        );
      }

      // Delete the quiz
      console.log("Deleting quiz:", quizId);
      const { error: quizError } = await supabase
        .from("quizzes")
        .delete()
        .eq("id", quizId);

      console.log("Quiz delete response - error:", quizError);

      if (quizError) {
        console.error("Quiz delete error:", quizError);
        throw new Error(`Failed to delete quiz: ${quizError.message}`);
      }

      // Wait a moment for the database to sync, then refresh
      console.log("Waiting for DB sync...");
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Refresh the quizzes list
      console.log("Refreshing quizzes list...");
      await fetchQuizzes();

      console.log("Quiz deleted successfully!");
      alert("✓ Quiz deleted successfully!");
    } catch (error) {
      console.error("Full error object:", error);
      alert("❌ Error deleting quiz:\n" + error.message);
    } finally {
      setDeletingQuizId(null);
    }
  };
  return { handleDeleteQuiz, deletingQuizId };
};
