import React, { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../context/AuthContext";
import * as ItemAnalysisService from "../../services/item-analysis/itemAnalysisService";
import { ItemAnalysisHeader } from "../../components/container/item-analysis/ItemAnalysisHeader";
import { ItemAnalysisResults } from "../../components/container/item-analysis/ItemAnalysisResults";
import { ItemAnalysisTable } from "../../components/container/item-analysis/ItemAnalysisTable";
import { EditChoiceModal } from "../../components/container/item-analysis/EditChoiceModal";
import { useDiscrimination } from "../../hooks/analysisHook/useDiscrimination";
import { notify } from "../../utils/notify.jsx";
import { Skeleton, SkeletonTableRow } from "../../components/ui/Skeleton.jsx";

export const ItemAnalysisPage = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const initialSectionId = searchParams.get("sectionId") || "";
  const initialQuizId = searchParams.get("quizId") || "";

  const [sections, setSections] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [selectedSection, setSelectedSection] = useState(initialSectionId);
  const [selectedQuiz, setSelectedQuiz] = useState(initialQuizId);
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
  const [testStats, setTestStats] = useState(null);
  const [allTakersList, setAllTakersList] = useState([]);
  const { handleDiscrimination } = useDiscrimination();

  // --- 0. Helper: Find Searched Student Info ---
  const searchedStudentInfo = useMemo(() => {
    if (!studentSearchTerm || analysis.length === 0) return null;

    // Use a map to collect unique attempts for this student name
    const matchingAttempts = new Map();

    for (const item of analysis) {
      (item.takersDetails || []).forEach((t) => {
        if (t.name.toLowerCase() === studentSearchTerm.toLowerCase()) {
          // Key by a combination of name and score to identify unique attempts shown in your screenshot
          const key = `${t.name}-${t.totalScore}`;
          if (!matchingAttempts.has(key)) {
            matchingAttempts.set(key, {
              name: t.name,
              totalScore: t.totalScore,
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
        if (!user) return;
        // Fetch only sections that are NOT archived
        const { data, error } = await supabase
          .from("sections")
          .select("id, name, description")
          .eq("instructor_id", user.id)
          .eq("is_archived", false);

        if (error) {
          console.error("Error fetching sections for item analysis:", error);
          setSections([]);
        } else {
          setSections(data || []);
        }
      } finally {
        setLoadingSections(false);
      }
    };
    fetchSections();
  }, [user?.id]);

  // --- 2. Fetch Quizzes ---
  useEffect(() => {
    const fetchQuizzes = async () => {
      if (!selectedSection) {
        setQuizzes([]);
        return;
      }
      setLoadingQuizzes(true);
      try {
        // 1. Get quizzes linked via quiz_sections junction table
        const { data: qsRows } = await supabase
          .from("quiz_sections")
          .select("quiz_id")
          .eq("section_id", selectedSection);

        const mappedQuizIds = (qsRows || []).map((r) => r.quiz_id).filter(Boolean);

        // 2. Also get quizzes linked directly via quizzes.section_id
        const { data: directRows } = await supabase
          .from("quizzes")
          .select("id")
          .eq("section_id", selectedSection)
          .eq("is_published", true)
          .eq("is_archived", false);

        const allCandidateIds = Array.from(
          new Set([...mappedQuizIds, ...(directRows || []).map((r) => r.id)])
        );

        let finalQuizzes = [];
        if (allCandidateIds.length > 0) {
          const { data: qData } = await supabase
            .from("quizzes")
            .select("id, title, is_published, is_archived")
            .in("id", allCandidateIds)
            .eq("is_published", true)
            .eq("is_archived", false);

          finalQuizzes = (qData || []).map((q) => ({
            ...q,
            title: q.title?.replace(/\s*\(Revised(?:\s+\d+)?\)\s*$/, "") || q.title,
          }));
        }

        setQuizzes(finalQuizzes);
      } catch (err) {
        console.error("Error fetching quizzes for item analysis:", err);
        setQuizzes([]);
      } finally {
        setLoadingQuizzes(false);
      }
    };
    fetchQuizzes();
  }, [selectedSection, user?.id]);

  // --- 3. Trigger Analysis ---
  useEffect(() => {
    setAnalysisSaved(false);
    setSaveError(null);
    if (selectedQuiz) fetchAndAnalyze(selectedQuiz);
    else {
      setAnalysis([]);
      setTestStats(null);
    }
  }, [selectedQuiz, selectedCohortFilter]);

  // --- 3.1. Listen for question updates ---
  useEffect(() => {
    const handleUpdate = () => {
      if (selectedQuiz) {
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

      setAnalysisSaved(true);
      notify.success("Analysis saved successfully!");
    } catch (err) {
      setSaveError(err.message);
      console.error("Save Error:", err);
      notify.error("Failed to save analysis: " + err.message);
    } finally {
      setSavingAnalysis(false);
    }
  };

  const onManualEdit = () => {
    setEditModalOpen(false);
    if (!selectedQuiz) return;
    navigate(
      location.pathname.startsWith("/admin-dashboard")
        ? `/admin-dashboard/create-quiz/${selectedQuiz}`
        : `/instructor-dashboard/instructor-quiz/${selectedQuiz}`,
    );
  };

  // Helper function to map answer to letter A/B/C/D
  const getLetter = (answer) => {
    const num = parseInt(answer);
    return isNaN(num) ? answer.toUpperCase() : String.fromCharCode(65 + num);
  };

  const fetchAndAnalyze = async (quizId) => {
    setLoading(true);
    try {
      // 0. Fetch Quiz Info to get parent_quiz_id
      const { data: qInfo } = await supabase
        .from("quizzes")
        .select("id, parent_quiz_id")
        .eq("id", quizId)
        .maybeSingle();

      const relatedQuizIds = [quizId];
      if (qInfo?.parent_quiz_id) relatedQuizIds.push(qInfo.parent_quiz_id);

      // 1. Fetch Quiz Data (Questions)
      let questions = [];
      const { data: directQs, error: qError } = await supabase
        .from("questions")
        .select(
          "id, text, type, options, correct_answer, points, revised_content, revised_options, original_text, original_options, original_correct_answer, revision_history, is_gad, ai_revised, created_at",
        )
        .eq("quiz_id", quizId)
        .order("created_at", { ascending: true });

      if (directQs && directQs.length > 0) {
        questions = directQs;
      } else if (qInfo?.parent_quiz_id) {
        const { data: parentQs } = await supabase
          .from("questions")
          .select(
            "id, text, type, options, correct_answer, points, revised_content, revised_options, original_text, original_options, original_correct_answer, revision_history, is_gad, ai_revised, created_at",
          )
          .eq("quiz_id", qInfo.parent_quiz_id)
          .order("created_at", { ascending: true });
        if (parentQs) questions = parentQs;
      }

      // Only completed attempts count toward item statistics
      let attemptsQuery = supabase
        .from("quiz_attempts")
        .select("*")
        .in("quiz_id", relatedQuizIds)
        .eq("status", "completed");

      if (selectedSection) {
        attemptsQuery = attemptsQuery.or(`section_id.eq.${selectedSection},section_id.is.null`);
      }

      const { data: baseAttempts } = await attemptsQuery;
      let attempts = baseAttempts || [];

      if (attempts.length === 0) {
        setAnalysis([]);
        setTestStats(null);
        setAllTakersList([]);
        return;
      }

      // Cohort filtering is done on the same section/version-scoped attempts
      if (selectedCohortFilter !== "all") {
        const sortedAttempts = [...attempts].sort((a, b) => (b.score || 0) - (a.score || 0));
        const totalAttempts = sortedAttempts.length;
        const totalPossiblePoints = questions.reduce((sum, q) => sum + (q.points || 1), 0);

        if (selectedCohortFilter === "top_performers") {
          attempts = sortedAttempts.slice(0, Math.ceil(totalAttempts * 0.25));
        } else if (selectedCohortFilter === "bottom_performers") {
          attempts = sortedAttempts.slice(-Math.ceil(totalAttempts * 0.25));
        } else if (selectedCohortFilter === "middle_performers") {
          attempts = sortedAttempts.slice(
            Math.floor(totalAttempts * 0.25),
            Math.ceil(totalAttempts * 0.75),
          );
        } else if (selectedCohortFilter === "perfect_scores") {
          attempts = attempts.filter((a) => (a.score || 0) >= totalPossiblePoints);
        } else if (selectedCohortFilter === "failing_scores") {
          attempts = attempts.filter((a) => (a.score || 0) < totalPossiblePoints * 0.6);
        }
      }

      // Map attempt IDs to student names and total scores for Discrimination math
      const takersMap = {};
      const attemptIds =
        attempts?.map((att) => {
          const displayName =
            att.guest_name ||
            att.student_name ||
            (att.user_id ? `Student ${att.user_id.slice(0, 8)}` : "Anonymous");

          takersMap[att.id] = {
            name: displayName,
            totalScore: att.score || 0,
            isGuest: !att.user_id,
            userId: att.user_id,
          };
          return att.id;
        }) || [];

      // 2. Fetch ALL individual responses for these students
      const { data: responses } = await supabase
        .from("quiz_responses")
        .select("*")
        .in("attempt_id", attemptIds);

      const results = questions.map((q) => {
        const qResponses =
          responses?.filter((r) => r.question_id === q.id) || [];
        const total = qResponses.length;

        // --- 3. DISTRACTOR ANALYSIS ---
        const distractorData =
          q.options?.map((opt, idx) => {
            const count = qResponses.filter(
              (r) =>
                String(r.answer) === String(opt) ||
                String(r.answer) === String(idx),
            ).length;

            return {
              text: opt,
              count: count,
              percentage: total > 0 ? ((count / total) * 100).toFixed(1) : 0,
              isCorrect: String(opt) === String(q.correct_answer),
            };
          }) || [];

        // --- 4. DIFFICULTY ($P$) ---
        const correctCount = qResponses.filter((r) => r.is_correct).length;
        const fi = total > 0 ? correctCount / total : 0;

        // --- 5. DISCRIMINATION ($D$) ---
        const discriminationData = handleDiscrimination(qResponses, takersMap);
        const discrimination = parseFloat(discriminationData.discrimination);
        const discStatus = discriminationData.discStatus;

        const sortedTakers = qResponses
          .map((r) => ({
            isCorrect: r.is_correct,
            totalScore: takersMap[r.attempt_id]?.totalScore || 0,
          }))
          .sort((a, b) => b.totalScore - a.totalScore);

        const highestScore =
          sortedTakers.length > 0 ? sortedTakers[0].totalScore : 0;
        const lowestScore =
          sortedTakers.length > 0
            ? sortedTakers[sortedTakers.length - 1].totalScore
            : 0;

        // --- 6. AI DECISION (Flag Logic) ---
        // REJECT: nobody / everybody answered correctly, or poor discrimination (< 0.20)
        // RETAIN: moderate difficulty (0.25-0.75) and good discrimination (>= 0.30)
        // REVISE: everything else
        const difficulty = fi;
        const discValue = discrimination;
        let autoFlag;
        if (total === 0) {
          autoFlag = "revise";
        } else if (difficulty === 0 || difficulty === 1 || discValue < 0.2) {
          autoFlag = "reject";
        } else if (difficulty >= 0.25 && difficulty <= 0.75 && discValue >= 0.3) {
          autoFlag = "approved";
        } else {
          autoFlag = "revise";
        }

        // --- 7. ICC / Decile Performance Calculation ---
        const decilePerformance = Array.from({ length: 10 }, (_, i) => {
          const decile = (i + 1) * 10;
          // Ability level based on score ranges (e.g., 0-10%, 10-20%...)
          const minScore = (highestScore * i) / 10;
          const maxScore = (highestScore * (i + 1)) / 10;

          const group = sortedTakers.filter(
            (t) => t.totalScore > minScore && t.totalScore <= maxScore,
          );

          const proportionRight =
            group.length > 0
              ? (group.filter((t) => t.isCorrect).length / group.length) * 100
              : 0;

          return {
            ability: decile,
            proportion: Math.round(proportionRight),
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
          status: fi > 0.75 ? "EASY" : fi >= 0.25 ? "MODERATE" : "DIFFICULT",
          discrimination: discrimination.toFixed(2),
          discStatus: discStatus,
          autoFlag: autoFlag,
          recommendation: discriminationData.recommendation,
          Pu: discriminationData.Pu,
          Pl: discriminationData.Pl,
          upperGroupSize: discriminationData.upperGroupSize,
          lowerGroupSize: discriminationData.lowerGroupSize,
          upperCorrect: discriminationData.upperCorrect,
          lowerCorrect: discriminationData.lowerCorrect,
          upperGroupNames: discriminationData.upperGroupNames || [],
          lowerGroupNames: discriminationData.lowerGroupNames || [],
          highestScore,
          lowestScore,
          totalResponses: total,
          decilePerformance,
          distractorAnalysis: distractorData,
          takersDetails: qResponses.map((r) => ({
            name: takersMap[r.attempt_id]?.name || "Student",
            answer: getLetter(r.answer),
            isCorrect: r.is_correct,
            totalScore: takersMap[r.attempt_id]?.totalScore || 0,
          })),
        };
      });

      // --- 8. TEST-LEVEL PSYCHOMETRICS & RELIABILITY (F2 & F1) ---
      const takerScores = (attempts || []).map((a) => a.score || 0);
      const sampleSize = takerScores.length;
      const questionCount = questions.length;

      let meanScore = 0;
      let variance = 0;
      let stdDev = 0;
      let kr20 = 0;
      let sem = 0;
      let semMean = 0;

      if (sampleSize > 0) {
        meanScore = takerScores.reduce((sum, s) => sum + s, 0) / sampleSize;
        if (sampleSize > 1) {
          variance =
            takerScores.reduce(
              (sum, s) => sum + Math.pow(s - meanScore, 2),
              0,
            ) /
            (sampleSize - 1);
        } else {
          variance = 0;
        }
        stdDev = Math.sqrt(variance);

        // Sum of item pass*fail variances (p_i * q_i)
        const sumPq = questions.reduce((sum, q) => {
          const qResps = responses?.filter((r) => r.question_id === q.id) || [];
          const cCount = qResps.filter((r) => r.is_correct).length;
          const p = qResps.length > 0 ? cCount / qResps.length : 0;
          return sum + p * (1 - p);
        }, 0);

        // KR-20 Internal Consistency Reliability
        if (questionCount > 1 && variance > 0) {
          const rawKr20 =
            (questionCount / (questionCount - 1)) * (1 - sumPq / variance);
          kr20 = Math.max(0, Math.min(1, rawKr20));
        }

        // Standard Error of Measurement
        sem = stdDev * Math.sqrt(Math.max(0, 1 - kr20));
        semMean = sampleSize > 1 ? stdDev / Math.sqrt(sampleSize) : 0;
      }

      setTestStats({
        sampleSize,
        questionCount,
        meanScore: meanScore.toFixed(2),
        stdDev: stdDev.toFixed(2),
        kr20Reliability: kr20.toFixed(2),
        sem: sem.toFixed(2),
        semMean: semMean.toFixed(2),
        isSmallSample: sampleSize > 0 && sampleSize < 10,
      });

      setAllTakersList(
        (attempts || []).map((att) => ({
          id: att.id,
          name:
            att.guest_name ||
            att.student_name ||
            (att.user_id ? `Student ${att.user_id.slice(0, 8)}` : "Anonymous"),
          score: att.score || 0,
        })),
      );

      setAnalysis(results);
    } catch (err) {
      console.error("Analysis Error:", err);
    } finally {
      setLoading(false);
    }
  };


  if (loadingSections)
    return (
      <div className="flex-1 overflow-auto bg-authentic-white min-h-screen p-6" aria-label="Loading item analysis">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="bg-gradient-to-r from-brand-navy to-brand-indigo px-6 py-8 -mx-6 -mt-6 mb-6">
            <div className="max-w-7xl mx-auto">
              <Skeleton tone="bg-white/20" className="h-4 w-44 rounded-md mb-2" />
              <Skeleton tone="bg-white/20" className="h-8 w-72 rounded-md" />
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <Skeleton className="h-11 w-full rounded-lg" />
              <Skeleton className="h-11 w-full rounded-lg" />
              <Skeleton className="h-11 w-full rounded-lg" />
              <Skeleton className="h-11 w-full rounded-lg" />
              <Skeleton className="h-11 w-full rounded-lg" />
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <SkeletonTableRow cells={4} />
            <SkeletonTableRow cells={4} />
            <SkeletonTableRow cells={4} />
          </div>
        </div>
      </div>
    );

  return (
    <div className="flex-1 overflow-auto bg-authentic-white min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <ItemAnalysisHeader
          sections={sections}
          quizzes={quizzes}
          selectedSection={selectedSection}
          selectedQuiz={selectedQuiz}
          loadingQuizzes={loadingQuizzes}
          onSectionChange={(id) => {
            setSelectedSection(id);
            setSelectedQuiz("");
            setSelectedCohortFilter("all");
          }}
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
          testStats={testStats}
          allTakers={allTakersList}
          totalAttempts={testStats?.sampleSize || 0}
        />

        {(() => {
          if (!selectedQuiz) return null;
          if (loading)
            return (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden" aria-label="Analyzing responses">
                <SkeletonTableRow cells={4} />
                <SkeletonTableRow cells={4} />
                <SkeletonTableRow cells={4} />
                <SkeletonTableRow cells={4} />
              </div>
            );
          if (analysis.length === 0)
            return (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-10 text-center">
                <p className="text-base font-bold text-slate-800 mb-1">
                  No responses found
                </p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  This quiz has no completed attempts for the selected filters yet. Share the quiz link to collect responses before running the analysis.
                </p>
              </div>
            );

          const filteredAnalysis = analysis.filter((item) =>
            item.text.toLowerCase().includes(searchTerm.toLowerCase()),
          );

          if (filteredAnalysis.length > 0) {
            return (
              <ItemAnalysisTable
                loading={loading}
                analysis={filteredAnalysis.map((item, idx) => ({
                  ...item,
                  index: idx,
                }))}
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
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-10 text-center">
                <p className="text-base font-bold text-slate-800 mb-1">
                  No matching questions
                </p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  No questions match "{searchTerm}". Try a different keyword.
                </p>
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
