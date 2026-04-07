import { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../context/AuthContext";

export const useFetchQuestion = () => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchQuestions = async () => {
    if (!user) return;
    try {

      // Fetch questions from Supabase
      const { data, error } = await supabase
        .from("questions")
.select("*, revision_history, revised_options, updated_at, created_at, quizzes(title)")
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
