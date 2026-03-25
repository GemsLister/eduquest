import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { quizService } from "../../services/quizService";
import { sectionService } from "../../services/sectionService";

export const useFetchSectionQuiz = () => {
  const [quizzes, setQuizzes] = useState([]);
  const [sectionQuizzes, setSectionQuizzes] = useState({});
  const [user, setUser] = useState(null); // Change from "" to null
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
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

        if (!authUser) {
          navigate("/");
          return;
        }

        const sectionsData = await sectionService.getSectionsByInstructor(
          authUser.id,
        );
        setSections(sectionsData);

        const { data: quizzesData, error: quizzesError } =
          await quizService.getQuizzesByInstructor(authUser.id);
        if (quizzesError) throw quizzesError;

        // Sections should only show published quizzes.
        const visibleQuizzes = (quizzesData || []).filter(
          (quiz) => quiz.is_published && !quiz.is_archived,
        );

        // Process quizzes data
        const processedQuizzes = visibleQuizzes.map((quiz) => ({
          ...quiz,
          attempts: quiz.quiz_attempts?.[0]?.count || 0,
        }));

        setQuizzes(processedQuizzes);

        // Fetch quiz_sections mapping
        const quizIds = processedQuizzes.map((q) => q.id);
        let quizSectionsData = [];

        if (quizIds.length > 0) {
          try {
            const { data: qsData, error: qsError } = await supabase
              .from("quiz_sections")
              .select("quiz_id, section_id")
              .in("quiz_id", quizIds);

            if (!qsError && qsData) {
              quizSectionsData = qsData;
            }
          } catch (e) {
            console.warn("Could not fetch quiz_sections", e);
          }
        }

        // Group quizzes by section
        const grouped = {};

        // 1. Group using mapping table
        quizSectionsData.forEach((qs) => {
          if (!grouped[qs.section_id]) {
            grouped[qs.section_id] = [];
          }
          const quiz = processedQuizzes.find((q) => q.id === qs.quiz_id);
          if (
            quiz &&
            !grouped[qs.section_id].some((existing) => existing.id === quiz.id)
          ) {
            grouped[qs.section_id].push(quiz);
          }
        });

        // 2. Group using legacy section_id (backward compatibility)
        processedQuizzes.forEach((quiz) => {
          if (quiz.section_id) {
            if (!grouped[quiz.section_id]) {
              grouped[quiz.section_id] = [];
            }
            if (
              !grouped[quiz.section_id].some(
                (existing) => existing.id === quiz.id,
              )
            ) {
              grouped[quiz.section_id].push(quiz);
            }
          }
        });

        // Re-count attempts per section (filter by section_id)
        for (const sectionId of Object.keys(grouped)) {
          const quizzesInSection = grouped[sectionId];
          const updatedQuizzes = await Promise.all(
            quizzesInSection.map(async (quiz) => {
              const { count } = await supabase
                .from("quiz_attempts")
                .select("*", { count: "exact", head: true })
                .eq("quiz_id", quiz.id)
                .eq("section_id", sectionId);
              return { ...quiz, attempts: count || 0 };
            }),
          );
          grouped[sectionId] = updatedQuizzes;
        }

        setSectionQuizzes(grouped);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [navigate]);
  {
    return { quizzes, sectionQuizzes, user, sections, setSections, loading };
  }
};
