import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../context/AuthContext";

export const useFetchQuestion = () => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchQuestions = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);

      // 1. Fetch user's quiz IDs
      const { data: ownQuizzes } = await supabase
        .from("quizzes")
        .select("id")
        .eq("instructor_id", user.id);
      const userQuizIds = (ownQuizzes || []).map((q) => q.id).filter(Boolean);

      // 2. Fetch direct quiz questions (no embedded relationship joins)
      let directQs = [];
      if (userQuizIds.length > 0) {
        const { data: qData, error: qErr } = await supabase
          .from("questions")
          .select("*")
          .in("quiz_id", userQuizIds)
          .order("created_at", { ascending: false });
        if (!qErr && qData) directQs = qData;
      }

      // 3. Fetch questions created by user directly
      let createdQs = [];
      const { data: cData, error: cErr } = await supabase
        .from("questions")
        .select("*")
        .or(`instructor_id.eq.${user.id},created_by.eq.${user.id}`)
        .order("created_at", { ascending: false });
      if (!cErr && cData) createdQs = cData;

      // 4. Fetch junction quiz_questions if any
      let junctionQs = [];
      if (userQuizIds.length > 0) {
        try {
          const { data: jData } = await supabase
            .from("quiz_questions")
            .select("question_id, quiz_id")
            .in("quiz_id", userQuizIds);
          if (jData && jData.length > 0) {
            const jqIds = jData.map((j) => j.question_id).filter(Boolean);
            if (jqIds.length > 0) {
              const { data: jqRows } = await supabase
                .from("questions")
                .select("*")
                .in("id", jqIds);
              junctionQs = jqRows || [];
            }
          }
        } catch (e) {
          console.warn("quiz_questions junction fetch skipped in useFetchQuestions", e);
        }
      }

      // Combine and deduplicate by question ID
      const questionMap = new Map();
      [...directQs, ...createdQs, ...junctionQs].forEach((q) => {
        if (q && q.id && !questionMap.has(q.id)) {
          questionMap.set(q.id, q);
        }
      });

      const combinedQuestions = Array.from(questionMap.values());

      // Fetch quiz titles separately in memory (prevents PGRST200 foreign key join errors)
      const referencedQuizIds = Array.from(
        new Set(combinedQuestions.map((q) => q.quiz_id).filter(Boolean))
      );

      let quizMetaMap = new Map();
      if (referencedQuizIds.length > 0) {
        try {
          const { data: quizzesMeta } = await supabase
            .from("quizzes")
            .select("id, title")
            .in("id", referencedQuizIds);
          if (quizzesMeta) {
            quizzesMeta.forEach((qz) => {
              quizMetaMap.set(qz.id, qz);
            });
          }
        } catch (e) {
          console.warn("Could not fetch quiz titles:", e);
        }
      }

      const finalQuestions = combinedQuestions.map((q) => ({
        ...q,
        quizzes: q.quiz_id ? quizMetaMap.get(q.quiz_id) || null : null,
      }));

      setQuestions(finalQuestions);
    } catch (error) {
      console.error("Error fetching questions:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  return { fetchQuestions, questions, loading };
};
