import { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";
export const useFetchQuestion = () => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const fetchQuestions = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch questions from Supabase
      const { data, error } = await supabase
        .from("questions")
        .select("*, quizzes(title)")
        .in(
          "quiz_id",
          (
            await supabase
              .from("quizzes")
              .select("id")
              .eq("instructor_id", user.id)
          ).data?.map((q) => q.id) || [],
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      setQuestions(data || []);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching questions:", error);
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchQuestions();
  }, []);
  return { fetchQuestions, questions, loading };
};
