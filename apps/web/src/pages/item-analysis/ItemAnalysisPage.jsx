import { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";
import * as ItemAnalysisService from "../../services/item-analysis/itemAnalysisService";
import { ItemAnalysisHeader } from "../../components/container/item-analysis/ItemAnalysisHeader";
import { ItemAnalysisResults } from "../../components/container/item-analysis/ItemAnalysisResults";
import { ItemAnalysisTable } from "../../components/container/item-analysis/ItemAnalysisTable";

export const ItemAnalysisPage = () => {
  const [sections, setSections] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedQuiz, setSelectedQuiz] = useState("");
  const [analysis, setAnalysis] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingSections, setLoadingSections] = useState(true);
  const [loadingQuizzes, setLoadingQuizzes] = useState(false);
  const [savingAnalysis, setSavingAnalysis] = useState(false);
  const [analysisSaved, setAnalysisSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [expandedQuestion, setExpandedQuestion] = useState(null);

  // --- 1. Fetch Sections ---
  useEffect(() => {
    const fetchSections = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from("sections")
            .select("id, name")
            .eq("instructor_id", user.id);
          setSections(data || []);
        }
      } finally {
        setLoadingSections(false);
      }
    };
    fetchSections();
  }, []);

  // --- 2. Fetch Quizzes ---
  useEffect(() => {
    const fetchQuizzes = async () => {
      if (!selectedSection) return;
      setLoadingQuizzes(true);
      const { data } = await supabase
        .from("quizzes")
        .select("id, title")
        .eq("section_id", selectedSection);
      setQuizzes(data || []);
      setLoadingQuizzes(false);
    };
    fetchQuizzes();
  }, [selectedSection]);

  // --- 3. Trigger Analysis ---
  useEffect(() => {
    if (selectedQuiz) fetchAndAnalyze(selectedQuiz);
    else setAnalysis([]);
  }, [selectedQuiz]);

  // --- 4. THE MISSING FUNCTION (The Fix for your Error) ---
  const handleSaveAnalysis = async () => {
    if (!selectedQuiz || analysis.length === 0) return;
    setSavingAnalysis(true);
    setSaveError(null);
    try {
      const { error } = await ItemAnalysisService.saveItemAnalysis(
        selectedQuiz,
        analysis,
      );
      if (error) throw error;
      setAnalysisSaved(true);
      alert("Analysis saved successfully!");
    } catch (err) {
      setSaveError(err.message);
      console.error("Save Error:", err);
    } finally {
      setSavingAnalysis(false);
    }
  };

  // --- 5. THE FETCH AND ANALYZE LOGIC (To see all students) ---
 const fetchAndAnalyze = async (quizId) => {
  try {
    setLoading(true);

    // 1. Fetch Questions and ALL Student Attempts
    const { data: questions } = await supabase.from("questions").select("*").eq("quiz_id", quizId);
    const { data: attempts } = await supabase.from("quiz_attempts").select("*").eq("quiz_id", quizId);

    // Map attempt IDs to student names and total scores for Discrimination math
    const takersMap = {};
    const attemptIds = attempts?.map(att => {
      takersMap[att.id] = { 
        name: att.student_name || "Anonymous", 
        score: att.score || 0 
      };
      return att.id;
    }) || [];

    // 2. Fetch ALL individual responses for these students
    const { data: responses } = await supabase.from("quiz_responses").select("*").in("attempt_id", attemptIds);

    const results = questions.map((q) => {
      const qResponses = responses?.filter(r => r.question_id === q.id) || [];
      const total = qResponses.length;

      // --- 3. DISTRACTOR ANALYSIS (For the Bar Chart) ---
      const distractorData = q.options?.map((opt, idx) => {
        // Counts how many students chose this specific option
        const count = qResponses.filter(r => 
          String(r.answer) === String(opt) || String(r.answer) === String(idx)
        ).length;

        return {
          text: opt,
          count: count,
          percentage: total > 0 ? ((count / total) * 100).toFixed(1) : 0,
          isCorrect: String(opt) === String(q.correct_answer)
        };
      }) || [];

      // --- 4. DIFFICULTY ($P$) ---
      const correctCount = qResponses.filter(r => r.is_correct).length;
      const fi = total > 0 ? correctCount / total : 0;

      // --- 5. DISCRIMINATION ($D$) ---
      let discrimination = 0;
      let discStatus = "POOR";

      if (total >= 2) {
        // Sort students by total quiz score to find high vs low performers
        const sorted = qResponses.map(r => ({
          isCorrect: r.is_correct,
          totalScore: takersMap[r.attempt_id]?.score || 0
        })).sort((a, b) => b.totalScore - a.totalScore);

        const groupSize = Math.max(1, Math.floor(total * 0.27));
        const upperGroup = sorted.slice(0, groupSize);
        const lowerGroup = sorted.slice(-groupSize);

        const upperP = upperGroup.filter(r => r.isCorrect).length / groupSize;
        const lowerP = lowerGroup.filter(r => r.isCorrect).length / groupSize;
        
        discrimination = upperP - lowerP;
        if (discrimination >= 0.40) discStatus = "EXCELLENT";
        else if (discrimination >= 0.20) discStatus = "GOOD";
      }

      // --- 6. AI DECISION (Flag Logic) ---
      const isGoodItem = fi >= 0.3 && fi <= 0.8 && discrimination >= 0.2;

      return {
        question_id: q.id,
        text: q.text,
        type: q.type,
        difficulty: total > 0 ? fi.toFixed(2) : "N/A",
        status: fi >= 0.75 ? "EASY" : fi >= 0.3 ? "MODERATE" : "DIFFICULT",
        discrimination: discrimination.toFixed(2),
        discStatus: discStatus,
        autoFlag: isGoodItem ? "retain" : "revise", // Sets the button color
        
        // Data for side-by-side Inspect view
        distractorAnalysis: distractorData, 
        takersDetails: qResponses.map(r => ({
          name: takersMap[r.attempt_id]?.name || "Student",
          answer: r.answer,
          isCorrect: r.is_correct
        }))
      };
    });

    setAnalysis(results);
  } catch (err) {
    console.error("Analysis Error:", err);
  } finally {
    setLoading(false);
  }
};

  if (loadingSections)
    return <div className="p-20 text-center">Loading Sections...</div>;

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        <ItemAnalysisHeader
          sections={sections}
          quizzes={quizzes}
          selectedSection={selectedSection}
          selectedQuiz={selectedQuiz}
          loadingQuizzes={loadingQuizzes}
          onSectionChange={setSelectedSection}
          onQuizChange={setSelectedQuiz}
        />

        <ItemAnalysisResults
          selectedQuiz={selectedQuiz}
          analysis={analysis}
          saveError={saveError}
          handleSaveAnalysis={handleSaveAnalysis}
          savingAnalysis={savingAnalysis}
          analysisSaved={analysisSaved}
        />

        {analysis.length > 0 && (
          <ItemAnalysisTable
            loading={loading}
            analysis={analysis}
            expandedQuestion={expandedQuestion}
            toggleDetails={(id) =>
              setExpandedQuestion(expandedQuestion === id ? null : id)
            }
          />
        )}
      </div>
    </div>
  );
};
