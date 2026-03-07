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

      // Fetch questions from Supabase with item_analysis flag
      const { data, error } = await supabase
        .from("questions")
        .select(`
          *,
          quizzes(title),
          flag,
          item_analysis!left(flag, auto_flag)
        `)
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

      // Process questions to use item_analysis flag if available
      const processedQuestions = (data || []).map(q => {
        // If item_analysis exists with an auto_flag, use that; otherwise use the question's flag
        if (q.item_analysis && q.item_analysis.length > 0 && q.item_analysis[0]?.auto_flag) {
          return { ...q, flag: q.item_analysis[0].auto_flag };
        }
        // Default to pending if no flag set
        return { ...q, flag: q.flag || "pending" };
      });

      setQuestions(processedQuestions);
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
