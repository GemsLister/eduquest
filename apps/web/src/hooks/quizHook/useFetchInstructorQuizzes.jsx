import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import { supabase } from "../../supabaseClient";

export const useFetchInstructorQuizzes = () => {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchQuizzes = useCallback(async () => {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;

      const { data, error } = await supabase
        .from("quizzes")
        .select("*, quiz_attempts(count)")
        .eq("instructor_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const quizzesWithCounts = await Promise.all(
        (data || []).map(async (quiz) => {
          const { count, error: countError } = await supabase
            .from("questions")
            .select("*", { count: "exact", head: true })
            .eq("quiz_id", quiz.id);

          return {
            ...quiz,
            attempts: quiz.quiz_attempts?.[0]?.count || 0,
            questions_count: !countError ? count : 0,
          };
        }),
      );

      setQuizzes(quizzesWithCounts);
    } catch (error) {
      console.error("Error fetching quizzes:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuizzes();
  }, [fetchQuizzes]);

  const handleRestoreQuiz = async (quizId) => {
    try {
      const { error } = await supabase
        .from("quizzes")
        .update({ is_archived: false })
        .eq("id", quizId);

      if (error) throw error;

      await fetchQuizzes();
      toast.success("Quiz restored successfully!");
    } catch (error) {
      console.error("Error restoring quiz:", error);
      toast.error("Error restoring quiz: " + error.message);
    }
  };

  const handleArchiveQuiz = async (quizId) => {
    try {
      const { error } = await supabase
        .from("quizzes")
        .update({ is_archived: true })
        .eq("id", quizId);

      if (error) throw error;

      await fetchQuizzes();
      toast.success("Quiz archived successfully!");
    } catch (error) {
      console.error("Error archiving quiz:", error);
      toast.error("Error archiving quiz: " + error.message);
    }
  };

  return {
    quizzes,
    loading,
    fetchQuizzes,
    handleRestoreQuiz,
    handleArchiveQuiz,
  };
};
