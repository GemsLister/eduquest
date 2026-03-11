import { useState, useEffect } from "react";
import * as ItemAnalysisService from "../../services/item-analysis/itemAnalysisService";
import { useFetchAnalyze } from "./useFetchAnalyze.jsx";

export const useFetchQuizzes = () => {
  const [quizzes, setQuizzes] = useState([]);
  const [loadingQuizzes, setLoadingQuizzes] = useState(false);
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedQuiz, setSelectedQuiz] = useState("");
  
  // Pull analysis and loading state directly from your analyzer hook
  const { fetchAndAnalyze, analysis, loading: loadingAnalysis } = useFetchAnalyze();

  // 1. Automatically fetch quizzes when the section selection changes
  useEffect(() => {
    const fetchQuizzes = async () => {
      if (!selectedSection) {
        setQuizzes([]);
        setSelectedQuiz(""); // Reset quiz selection if section is cleared
        return;
      }

      setLoadingQuizzes(true);
      try {
        // Ensure you await the service call
        const { data: quizzesData, error: quizzesError } = 
          await ItemAnalysisService.getQuizzes(selectedSection);

        if (quizzesError) throw quizzesError;
        setQuizzes(quizzesData || []);
      } catch (err) {
        console.error("Error fetching quizzes:", err);
      } finally {
        setLoadingQuizzes(false);
      }
    };

    fetchQuizzes();
  }, [selectedSection]);

  // 2. Automatically run the item analysis when a quiz is selected
  useEffect(() => {
    if (selectedQuiz) {
      fetchAndAnalyze(selectedQuiz);
    }
  }, [selectedQuiz, fetchAndAnalyze]);

  return {
    quizzes,
    loadingQuizzes,
    selectedSection,
    setSelectedSection,
    selectedQuiz,
    setSelectedQuiz,
    analysis, // This now comes from useFetchAnalyze
    loadingAnalysis
  };
};