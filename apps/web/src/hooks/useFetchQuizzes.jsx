import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";

export const useFetchQuizzes = () => {
  const { sectionId } = useParams();
  const [section, setSection] = useState(null);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const fetchQuizzes = async () => {
    try {
      // Fetch quizzes for this section
      const { data: quizzesData, error: quizzesError } = await supabase
        .from("quizzes")
        .select("*, quiz_attempts(count)")
        .eq("section_id", sectionId)
        .order("created_at", { ascending: false });

      if (quizzesError) throw quizzesError;

      // Fetch question counts for each quiz
      const quizzesWithCounts = await Promise.all(
        (quizzesData || []).map(async (quiz) => {
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
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get current user
        const {
          data: { user: authUser },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError) throw authError;
        setUser(authUser);

        // Fetch section
        const { data: sectionData, error: sectionError } = await supabase
          .from("sections")
          .select("*")
          .eq("id", sectionId)
          .single();

        if (sectionError) throw sectionError;
        setSection(sectionData);  

        // Fetch quizzes
        await fetchQuizzes();
      } catch (error) {
        console.error("Error fetching section data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [sectionId]);
  return { fetchQuizzes, section, quizzes, loading, user };
};
