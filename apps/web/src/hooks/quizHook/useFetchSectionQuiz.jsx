import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { quizService } from "../../services/quizService";
import { sectionService } from "../../services/sectionService";

export const useFetchSectionQuiz = () => {
  const [quizzes, setQuizzes] = useState([]);
  const [sectionQuizzes, setSectionQuizzes] = useState({});
  const [user, setUser] = useState("");
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

        const quizzesData = await quizService.getQuizzesByInstructor(
          authUser.id,
        );

        // Process quizzes data
        const processedQuizzes = (quizzesData || []).map((quiz) => ({
          ...quiz,
          attempts: quiz.quiz_attempts?.[0]?.count || 0,
        }));

        setQuizzes(processedQuizzes);

        // Group quizzes by section
        const grouped = {};
        processedQuizzes.forEach((quiz) => {
          if (quiz.section_id) {
            if (!grouped[quiz.section_id]) {
              grouped[quiz.section_id] = [];
            }
            grouped[quiz.section_id].push(quiz);
          }
        });
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
