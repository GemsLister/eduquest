import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../../supabaseClient";
import * as ItemAnalysisService from "../../services/item-analysis/itemAnalysisService";
import { createQuizVersion } from "../../services/item-analysis/createQuizVersion";
import { ItemAnalysisHeader } from "../../components/container/item-analysis/ItemAnalysisHeader";
import { ItemAnalysisResults } from "../../components/container/item-analysis/ItemAnalysisResults";
import { ItemAnalysisTable } from "../../components/container/item-analysis/ItemAnalysisTable";
import { EditChoiceModal } from "../../components/container/item-analysis/EditChoiceModal";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [studentSearchTerm, setStudentSearchTerm] = useState("");
  const [selectedCohortFilter, setSelectedCohortFilter] = useState("all");
  const [cohortOptions, setCohortOptions] = useState([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState(null);

  // --- 0. Helper: Find Searched Student Info ---
  const searchedStudentInfo = useMemo(() => {
    if (!studentSearchTerm || analysis.length === 0) return null;
    
    // Use a map to collect unique attempts for this student name
    const matchingAttempts = new Map();
    
    for (const item of analysis) {
      (item.takersDetails || []).forEach(t => {
        if (t.name.toLowerCase().includes(studentSearchTerm.toLowerCase())) {
          // Key by a combination of name and score to identify unique attempts shown in your screenshot
          const key = `${t.name}-${t.totalScore}`;
          if (!matchingAttempts.has(key)) {
            matchingAttempts.set(key, {
              name: t.name,
              totalScore: t.totalScore
            });
          }
        }
      });
    }
    
    return Array.from(matchingAttempts.values());
  }, [studentSearchTerm, analysis]);

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
  }, [selectedQuiz, selectedCohortFilter]);

  // --- 3.1. Listen for question updates ---
  useEffect(() => {
    const handleUpdate = () => {
      if (selectedQuiz) {
        console.log("Question updated, re-fetching analysis...");
        fetchAndAnalyze(selectedQuiz);
      }
    };
    window.addEventListener("questions-updated", handleUpdate);
    return () => window.removeEventListener("questions-updated", handleUpdate);
  }, [selectedQuiz]);

  // --- 3.5. Update cohort options when section changes ---
  useEffect(() => {
    if (selectedSection) {
      setCohortOptions([
        { value: "top_performers", label: "Top 25% Performers" },
        { value: "bottom_performers", label: "Bottom 25% Performers" },
        { value: "middle_performers", label: "Middle 50% Performers" },
        { value: "perfect_scores", label: "Perfect Scores Only" },
        { value: "failing_scores", label: "Failing Scores (<60%)" },
      ]);
    } else {
      setCohortOptions([]);
    }
  }, [selectedSection]);

  // --- 4. Save Analysis ---
  const handleSaveAnalysis = async () => {
    if (!selectedQuiz || analysis.length === 0) return;
    setSavingAnalysis(true);
    setSaveError(null);
    try {
      // Save the analysis
      const { error } = await ItemAnalysisService.saveItemAnalysis(
        selectedQuiz,
        analysis,
      );
      if (error) throw error;

      // Check if there are any revisions (either pending revisions or revision history)
      const revisedQuestions = analysis.filter(
        (item) => 
          item.revised_content || 
          item.revised_options || 
          item.revised_correct_answer || 
          (item.revision_history && item.revision_history.length > 0)
      );

      // If there are revisions, automatically create a new quiz version
      if (revisedQuestions.length > 0) {
        const { quizId: newQuizId, error: versionError } = await createQuizVersion(
          selectedQuiz,
          revisedQuestions
        );

        if (versionError) {
          console.warn("Could not auto-create quiz version:", versionError);
          alert(
            `Analysis saved! However, automatic quiz version creation failed: ${versionError}. You can manually create a new version if needed.`
          );
        } else {
          setAnalysisSaved(true);
          alert(
            `Analysis saved successfully!\n\nA new quiz version has been automatically created with your revisions. You can find it in your quiz library.`
          );
        }
      } else {
        setAnalysisSaved(true);
        alert("Analysis saved successfully!");
      }
    } catch (err) {
      setSaveError(err.message);
      console.error("Save Error:", err);
    } finally {
      setSavingAnalysis(false);
    }
  };

  const onManualEdit = () => {
    // Redirect to manual edit page or form
    if (selectedQuestion) {
      window.location.href = `/instructor-dashboard/edit-question/${selectedQuestion.question_id}`;
    }
    setEditModalOpen(false);
  };

  // Helper function to map answer to letter A/B/C/D
  const getLetter = (answer) => {
    const num = parseInt(answer);
    return isNaN(num) ? answer.toUpperCase() : String.fromCharCode(65 + num);
  };

  // --- 5. Fetch and Analyze Logic ---
  const fetchAndAnalyze = async (quizId) => {
    setLoading(true);
    try {
      // 1. Fetch Quiz Data (Questions)
      const { data: questions, error: qError } = await supabase
        .from("questions")
        .select("id, text, type, options, correct_answer, points, revised_content, revised_options, original_text, original_options, original_correct_answer, revision_history")
        .eq("quiz_id", quizId);
      if (qError) throw qError;
      
      let attemptsQuery = supabase.from("quiz_attempts").select("*").eq("quiz_id", quizId);
      
      // Apply cohort filtering
      if (selectedCohortFilter !== "all" && selectedSection) {
        // First get all attempts to calculate performance-based cohorts
        const { data: allAttempts } = await supabase
          .from("quiz_attempts")
          .select("*")
          .eq("quiz_id", quizId);

        if (!allAttempts || allAttempts.length === 0) {
          setAnalysis([]);
          setLoading(false);
          return;
        }

        // Sort by score to calculate percentiles
        const sortedAttempts = allAttempts.sort((a, b) => (b.score || 0) - (a.score || 0));
        const totalAttempts = sortedAttempts.length;
        
        let filteredAttempts = [];

        if (selectedCohortFilter === "top_performers") {
          // Top 25% performers
          const topCount = Math.ceil(totalAttempts * 0.25);
          filteredAttempts = sortedAttempts.slice(0, topCount);
        } else if (selectedCohortFilter === "bottom_performers") {
          // Bottom 25% performers
          const bottomCount = Math.ceil(totalAttempts * 0.25);
          filteredAttempts = sortedAttempts.slice(-bottomCount);
        } else if (selectedCohortFilter === "middle_performers") {
          // Middle 50% performers
          const startIndex = Math.floor(totalAttempts * 0.25);
          const endIndex = Math.ceil(totalAttempts * 0.75);
          filteredAnalysis = sortedAttempts.slice(startIndex, endIndex);
        } else if (selectedCohortFilter === "perfect_scores") {
          // Only students with perfect scores (100% of possible points)
          // First get total possible points for this quiz
          const { data: questions } = await supabase
            .from("questions")
            .select("points")
            .eq("quiz_id", quizId);
          
          const totalPossiblePoints = questions?.reduce((sum, q) => sum + (q.points || 1), 0) || 0;
          
          filteredAttempts = allAttempts.filter(a => (a.score || 0) === totalPossiblePoints);
        } else if (selectedCohortFilter === "failing_scores") {
          // Students with scores below 60%
          const { data: questions } = await supabase
            .from("questions")
            .select("points")
            .eq("quiz_id", quizId);
          
          const totalPossiblePoints = questions?.reduce((sum, q) => sum + (q.points || 1), 0) || 0;
          const passingThreshold = totalPossiblePoints * 0.6;
          
          filteredAttempts = allAttempts.filter(a => (a.score || 0) < passingThreshold);
        }

        // Use the filtered attempts for analysis
        const filteredAttemptIds = filteredAttempts.map(a => a.id);
        attemptsQuery = supabase
          .from("quiz_attempts")
          .select("*")
          .eq("quiz_id", quizId)
          .in("id", filteredAttemptIds);
      }
      
      const { data: attempts } = await attemptsQuery;

      // Map attempt IDs to student names and total scores for Discrimination math
      const takersMap = {};
      const attemptIds = attempts?.map(att => {
        const displayName = att.guest_name || att.student_name || 
          (att.user_id ? `Student ${att.user_id.slice(0, 8)}` : "Anonymous");
        
        takersMap[att.id] = { 
          name: displayName, 
          totalScore: att.score || 0,
          isGuest: !att.user_id,
          userId: att.user_id
        };
        return att.id;
      }) || [];

      // 2. Fetch ALL individual responses for these students
      const { data: responses } = await supabase.from("quiz_responses").select("*").in("attempt_id", attemptIds);

      const results = questions.map((q) => {
        const qResponses = responses?.filter(r => r.question_id === q.id) || [];
        const total = qResponses.length;

        // --- 3. DISTRACTOR ANALYSIS ---
        const distractorData = q.options?.map((opt, idx) => {
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

        const sortedTakers = qResponses.map(r => ({
          isCorrect: r.is_correct,
          totalScore: takersMap[r.attempt_id]?.totalScore || 0
        })).sort((a, b) => b.totalScore - a.totalScore);

        const highestScore = sortedTakers.length > 0 ? sortedTakers[0].totalScore : 0;
        const lowestScore = sortedTakers.length > 0 ? sortedTakers[sortedTakers.length - 1].totalScore : 0;

        if (total >= 2) {
          const groupSize = Math.max(1, Math.floor(total * 0.27));
          const upperGroup = sortedTakers.slice(0, groupSize);
          const lowerGroup = sortedTakers.slice(-groupSize);

          const upperP = upperGroup.filter(r => r.isCorrect).length / groupSize;
          const lowerP = lowerGroup.filter(r => r.isCorrect).length / groupSize;
          
          discrimination = upperP - lowerP;
          if (discrimination >= 0.40) discStatus = "EXCELLENT";
          else if (discrimination >= 0.20) discStatus = "GOOD";
        }

        // --- 6. AI DECISION (Flag Logic) ---
        const isGoodItem = fi >= 0.3 && fi <= 0.8 && discrimination >= 0.2;

        // --- 7. ICC / Decile Performance Calculation ---
        const decilePerformance = Array.from({ length: 10 }, (_, i) => {
          const decile = (i + 1) * 10;
          // Ability level based on score ranges (e.g., 0-10%, 10-20%...)
          const minScore = (highestScore * i) / 10;
          const maxScore = (highestScore * (i + 1)) / 10;
          
          const group = sortedTakers.filter(t => 
            t.totalScore > minScore && t.totalScore <= maxScore
          );
          
          const proportionRight = group.length > 0 
            ? (group.filter(t => t.isCorrect).length / group.length) * 100 
            : 0;
            
          return {
            ability: decile,
            proportion: Math.round(proportionRight)
          };
        });

        return {
          question_id: q.id,
          text: q.text,
          type: q.type,
          options: q.options,
          correct_answer: q.correct_answer,
          revised_content: q.revised_content,
          revised_options: q.revised_options,
          original_text: q.original_text,
          original_options: q.original_options,
          original_correct_answer: q.original_correct_answer,
          revision_history: q.revision_history || [],
          difficulty: total > 0 ? fi.toFixed(2) : "N/A",
          status: fi >= 0.75 ? "EASY" : fi >= 0.3 ? "MODERATE" : "DIFFICULT",
          discrimination: discrimination.toFixed(2),
          discStatus: discStatus,
          autoFlag: isGoodItem ? "approved" : "revise",
          highestScore,
          lowestScore,
          totalResponses: total,
          decilePerformance,
          distractorAnalysis: distractorData,
          takersDetails: qResponses.map(r => ({
            name: takersMap[r.attempt_id]?.name || "Student",
            answer: getLetter(r.answer),
            isCorrect: r.is_correct,
            totalScore: takersMap[r.attempt_id]?.totalScore || 0
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
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand-gold"></div>
          <p className="mt-4 text-brand-navy font-semibold">Loading sections...</p>
        </div>
      </div>
    );

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
          onSearchChange={setSearchTerm}
          onStudentSearchChange={setStudentSearchTerm}
          onCohortFilterChange={setSelectedCohortFilter}
          selectedCohortFilter={selectedCohortFilter}
          cohortOptions={cohortOptions}
          searchedStudent={searchedStudentInfo}
        />

        <ItemAnalysisResults
          selectedQuiz={selectedQuiz}
          analysis={analysis}
          saveError={saveError}
          handleSaveAnalysis={handleSaveAnalysis}
          savingAnalysis={savingAnalysis}
          analysisSaved={analysisSaved}
          selectedCohortFilter={selectedCohortFilter}
        />

        {(() => {
          if (!selectedQuiz) return null;
          if (loading) return (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-brand-gold"></div>
                <p className="mt-3 text-brand-navy font-semibold text-sm">Analyzing...</p>
              </div>
            </div>
          );
          if (analysis.length === 0) return <div className="text-center py-8">No responses found for this quiz.</div>;

          const filteredAnalysis = analysis.filter((item) =>
            item.text.toLowerCase().includes(searchTerm.toLowerCase())
          );

          if (filteredAnalysis.length > 0) {
            return (
              <ItemAnalysisTable
                loading={loading}
                analysis={filteredAnalysis.map((item, idx) => ({...item, index: idx}))}
                studentSearchTerm={studentSearchTerm}
                expandedQuestion={expandedQuestion}
                toggleDetails={(id) =>
                  setExpandedQuestion(expandedQuestion === id ? null : id)
                }
                onFlagClick={(item) => {
                  setSelectedQuestion(item);
                  setEditModalOpen(true);
                }}
              />
            );
          }
          if (searchTerm && filteredAnalysis.length === 0) {
            return (
              <div className="text-center py-8 text-gray-500">
                No questions match "{searchTerm}"
              </div>
            );
          }
          return null;
        })()}

        <EditChoiceModal 
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          questionData={selectedQuestion}
          onManualEdit={onManualEdit}
          questionId={selectedQuestion?.question_id}
        />

      </div>
    </div>
  );
};

