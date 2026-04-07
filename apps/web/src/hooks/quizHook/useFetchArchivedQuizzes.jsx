import { useState, useEffect, useCallback } from "react";
import { notify } from "../../utils/notify.jsx";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../context/AuthContext";

export const useFetchArchivedQuizzes = () => {
  const { user } = useAuth();
  const [archivedQuizzes, setArchivedQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchArchivedQuizzes = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("quizzes")
        .select("*, quiz_attempts(count)")
        .eq("instructor_id", user.id)
        .eq("is_archived", true)
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

      setArchivedQuizzes(quizzesWithCounts);
    } catch (error) {
      console.error("Error fetching archived quizzes:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchArchivedQuizzes();
  }, [fetchArchivedQuizzes]);

  const handleRestoreQuiz = async (quizId) => {
    try {
      const { error } = await supabase
        .from("quizzes")
        .update({ is_archived: false })
        .eq("id", quizId);

      if (error) throw error;

      await fetchArchivedQuizzes();
      notify.success("Quiz restored successfully!");
    } catch (error) {
      console.error("Error restoring quiz:", error);
      notify.error("Error restoring quiz: " + error.message);
    }
  };

  return { archivedQuizzes, loading, fetchArchivedQuizzes, handleRestoreQuiz };
};
