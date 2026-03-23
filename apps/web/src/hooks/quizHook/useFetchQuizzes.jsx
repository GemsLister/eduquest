import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../supabaseClient";

export const useFetchQuizzes = () => {
  const { sectionId } = useParams();
  const [section, setSection] = useState(null);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  const generateShareToken = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let token = "";
    for (let i = 0; i < 12; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  };

  const getUniqueShareToken = async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateShareToken();
      const { data, error } = await supabase
        .from("quizzes")
        .select("id")
        .eq("share_token", candidate)
        .maybeSingle();

      if (error) throw error;
      if (!data) return candidate;
    }

    throw new Error("Failed to generate a unique share token");
  };

  const fetchQuizzes = async () => {
    try {
      // First try to fetch from quiz_sections table (if it exists)
      let quizIds = [];
      const { data: qsData, error: qsError } = await supabase
        .from("quiz_sections")
        .select("quiz_id")
        .eq("section_id", sectionId);

      if (!qsError && qsData) {
        quizIds = qsData.map((qs) => qs.quiz_id);
      }

      // Also get any quizzes directly linked to this section (backward compatibility)
      const { data: directQuizzes, error: directError } = await supabase
        .from("quizzes")
        .select("id")
        .eq("section_id", sectionId);

      if (!directError && directQuizzes) {
        directQuizzes.forEach((q) => {
          if (!quizIds.includes(q.id)) quizIds.push(q.id);
        });
      }

      let quizzesData = [];
      if (quizIds.length > 0) {
        const { data, error: quizzesError } = await supabase
          .from("quizzes")
          .select("*, quiz_attempts(count)")
          .in("id", quizIds)
          .eq("is_archived", false)
          .eq("is_published", true)
          .order("created_at", { ascending: false });

        if (quizzesError) throw quizzesError;
        quizzesData = data;

        const missingTokenQuizzes = (quizzesData || []).filter(
          (quiz) => quiz.is_published && !quiz.share_token,
        );

        for (const quiz of missingTokenQuizzes) {
          const token = await getUniqueShareToken();
          const { error: tokenError } = await supabase
            .from("quizzes")
            .update({ share_token: token })
            .eq("id", quiz.id);

          if (!tokenError) {
            quiz.share_token = token;
          }
        }
      }

      // Fetch question counts for each quiz
      const quizzesWithCounts = await Promise.all(
        (quizzesData || []).map(async (quiz) => {
          const { count, error: countError } = await supabase
            .from("questions")
            .select("*", { count: "exact", head: true })
            .eq("quiz_id", quiz.id)
            .is("is_archived", false);

          const attemptsCount = quiz.quiz_attempts?.[0]?.count || 0;

          return {
            ...quiz,
            attempts: attemptsCount,
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
