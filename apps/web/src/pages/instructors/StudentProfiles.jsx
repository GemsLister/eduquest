import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../supabaseClient.js";
import { itemAnalysisService } from "../../services/itemAnalysisService";

export const StudentProfiles = () => {
  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState(null);
  const [performanceFilter, setPerformanceFilter] = useState("all"); // all, strong, average, weak

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const studentsPerPage = 10;

  // Item analysis states
  const [quizzes, setQuizzes] = useState([]);
  const [selectedQuiz, setSelectedQuiz] = useState("");
  const [analysis, setAnalysis] = useState([]);
  const [analysisSaved, setAnalysisSaved] = useState(false);

  const formatSubjectLabel = (subject) => {
    if (!subject) return "";
    const name = String(subject.name || subject.section_name || "").trim();
    const code = String(subject.description || "").trim();

    return code ? `${name} ${code}`.trim() : name;
  };

  // Fetch subjects and students on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setError("User not authenticated");
          setLoading(false);
          return;
        }
        setUserId(user.id);

        setLoading(true);

        // Fetch instructor's active sections (subjects)
        const { data: sectionsData, error: sectionsError } = await supabase
          .from("sections")
          .select("id, name, description")
          .eq("instructor_id", user.id)
          .eq("is_archived", false)
          .order("name", { ascending: true });

        if (sectionsError) throw sectionsError;

        setSubjects(sectionsData || []);

        // Don't load students initially - load them when subject is selected
        setStudents([]);

        // Fetch quizzes for item analysis
        if (sectionsData && sectionsData.length > 0) {
          const { data: quizzesData } = await supabase
            .from("quizzes")
            .select("id, title")
            .eq("section_id", sectionsData[0].id)
            .eq("is_published", true)
            .eq("is_archived", false)
            .order("created_at", { ascending: true });

          setQuizzes(quizzesData || []);
        }
      } catch (err) {
        setError(err.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Fetch item analysis when quiz is selected
  useEffect(() => {
    if (selectedQuiz) {
      fetchItemAnalysis(selectedQuiz);
    }
  }, [selectedQuiz]);

  const fetchItemAnalysis = async (quizId) => {
    try {
      setLoading(true);
      const { data: analysisData } = await supabase
        .from("item_analysis")
        .select("*")
        .eq("quiz_id", quizId)
        .order("question_id", { ascending: true });

      setAnalysis(analysisData || []);
      setAnalysisSaved(false);
    } catch (err) {
      setError(err.message || "Failed to fetch item analysis");
    } finally {
      setLoading(false);
    }
  };

  // Calculate percentile for a score
  const calculatePercentile = (score, allScores) => {
    if (!allScores || allScores.length === 0) return 0;

    const sortedScores = [...allScores].sort((a, b) => a - b);

    // Count how many scores are less than the current score
    const lowerScores = sortedScores.filter((s) => s < score);
    // Count how many scores are equal to the current score
    const equalScores = sortedScores.filter((s) => s === score);

    // Calculate percentile: (lower scores + half of equal scores) / total scores
    const percentile =
      ((lowerScores.length + equalScores.length * 0.5) / sortedScores.length) *
      100;

    return Math.round(percentile);
  };

  // Get color based on score percentage
  const getPercentileColor = (percentile) => {
    if (percentile >= 80) return "text-emerald-700 bg-emerald-50 border border-emerald-200";
    if (percentile >= 60) return "text-amber-700 bg-amber-50 border border-amber-200";
    return "text-rose-700 bg-rose-50 border border-rose-200";
  };

  // State for subject results
  const [subjectResults, setSubjectResults] = useState([]);
  const [subjectQuizzes, setSubjectQuizzes] = useState([]);

  // Filter student results based on search and performance
  const filteredResults = useMemo(() => {
    let results = subjectResults;

    // Filter by search
    if (studentSearch) {
      results = results.filter((student) =>
        student.student_name
          .toLowerCase()
          .includes(studentSearch.toLowerCase()),
      );
    }

    // Filter by performance
    if (performanceFilter !== "all") {
      results = results.filter((student) => {
        const percentage = student.percentageScore;
        switch (performanceFilter) {
          case "strong":
            return percentage >= 80;
          case "average":
            return percentage >= 60 && percentage < 80;
          case "weak":
            return percentage < 60;
          default:
            return true;
        }
      });
    }

    return results;
  }, [subjectResults, studentSearch, performanceFilter]);

  // Pagination logic
  const paginatedResults = useMemo(() => {
    const startIndex = (currentPage - 1) * studentsPerPage;
    const endIndex = startIndex + studentsPerPage;
    return filteredResults.slice(startIndex, endIndex);
  }, [filteredResults, currentPage]);

  const totalPages = Math.ceil(filteredResults.length / studentsPerPage);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [studentSearch]);

  // Update results when subject changes
  useEffect(() => {
    if (selectedSubject) {
      const fetchResults = async () => {
        setLoading(true);
        try {
          // Fetch quizzes for this subject first to see which quizzes have results
          const { data: attemptsData, error: attemptsError } = await supabase
            .from("quiz_attempts")
            .select("quiz_id")
            .eq("section_id", selectedSubject);

          if (attemptsError) throw attemptsError;

          // Get unique quiz IDs that have attempts in this subject
          const quizIdsWithAttempts = [
            ...new Set(
              attemptsData?.map((a) => a.quiz_id).filter((id) => id != null),
            ),
          ];

          let allQuizzes = [];
          if (quizIdsWithAttempts.length > 0) {
            // Fetch these quizzes, but only if they are not archived and are published
            const { data: quizzesData, error: quizzesError } = await supabase
              .from("quizzes")
              .select("id, title, is_archived, is_published, created_at")
              .in("id", quizIdsWithAttempts)
              .eq("is_published", true)
              .neq("is_archived", true);

            if (quizzesError) throw quizzesError;

            // Get question counts for each quiz to use as total_items
            const quizzesWithCounts = await Promise.all(
              (quizzesData || []).map(async (quiz) => {
                const { count } = await supabase
                  .from("questions")
                  .select("*", { count: "exact", head: true })
                  .eq("quiz_id", quiz.id);
                return { ...quiz, total_items: count || 0 };
              }),
            );

            allQuizzes = quizzesWithCounts;
          }

          // Also check for any active quizzes assigned to this section that might not have attempts yet
          // 1. Direct assignment
          const { data: directQuizzesData } = await supabase
            .from("quizzes")
            .select("id, title, is_archived, is_published, created_at")
            .eq("section_id", selectedSubject)
            .neq("is_archived", true);
          
          if (directQuizzesData) {
            const directWithCounts = await Promise.all(
              directQuizzesData.map(async (quiz) => {
                const { count } = await supabase
                  .from("questions")
                  .select("*", { count: "exact", head: true })
                  .eq("quiz_id", quiz.id);
                return { ...quiz, total_items: count || 0 };
              }),
            );

            directWithCounts.forEach((dq) => {
              if (!allQuizzes.find((aq) => aq.id === dq.id)) {
                allQuizzes.push(dq);
              }
            });
          }

          // 2. Mapped assignment
          const { data: mappedQuizIds } = await supabase
            .from("quiz_sections")
            .select("quiz_id")
            .eq("section_id", selectedSubject);

          if (mappedQuizIds && mappedQuizIds.length > 0) {
            const mIds = mappedQuizIds.map((mq) => mq.quiz_id);
            const { data: mappedQuizzesData } = await supabase
              .from("quizzes")
              .select("id, title, is_archived, is_published, created_at")
              .in("id", mIds)
              .neq("is_archived", true);
            
            if (mappedQuizzesData) {
              const mappedWithCounts = await Promise.all(
                mappedQuizzesData.map(async (quiz) => {
                  const { count } = await supabase
                    .from("questions")
                    .select("*", { count: "exact", head: true })
                    .eq("quiz_id", quiz.id);
                  return { ...quiz, total_items: count || 0 };
                }),
              );

              mappedWithCounts.forEach((mq) => {
                if (!allQuizzes.find((aq) => aq.id === mq.id)) {
                  allQuizzes.push(mq);
                }
              });
            }
          }

          allQuizzes.sort(
            (a, b) => new Date(a.created_at) - new Date(b.created_at),
          );

          console.log("Unified active quizzes for subject:", allQuizzes);
          setSubjectQuizzes(allQuizzes);

          const results = await getSubjectResultsForStudents([], allQuizzes);
          setSubjectResults(results);

          // Auto-select first quiz for item analysis if available
          if (allQuizzes.length > 0) {
            setSelectedQuiz(allQuizzes[0].id);
          }
        } catch (err) {
          setError(err.message || "Failed to load results");
        } finally {
          setLoading(false);
        }
      };

      fetchResults();
    } else {
      setSubjectResults([]);
      setSubjectQuizzes([]);
      setSelectedQuiz("");
      setAnalysis([]);
    }
  }, [selectedSubject]);

  // Helper function to get results for specific students
  const getSubjectResultsForStudents = async (
    studentsToProcess,
    quizzesData,
  ) => {
    if (selectedSubject === "") return [];

    try {
      // Debug: Log the incoming quizzes data
      console.log("DEBUG - getSubjectResultsForStudents called with:");
      console.log("studentsToProcess:", studentsToProcess);
      console.log("quizzesData:", quizzesData);
      console.log("Number of quizzes:", quizzesData?.length);

      // Fetch quiz attempts for this specific subject - remove status filter to get all attempts
      const { data: attemptsData, error: attemptsError } = await supabase
        .from("quiz_attempts")
        .select(
          `
          user_id,
          student_id,
          student_name,
          quiz_id, 
          score,
          sections!inner(name)
        `,
        )
        .eq("section_id", selectedSubject);

      if (attemptsError) throw attemptsError;

      console.log("All quiz attempts for subject:", attemptsData);
      console.log("Total attempts count:", attemptsData?.length);

      // Unified helper to get a student's identification
      const getStudentId = (attempt) => attempt.user_id || attempt.student_id;

      // Check for duplicate attempts
      const duplicateCheck = new Map();
      attemptsData?.forEach((attempt) => {
        const key = `${getStudentId(attempt)}-${attempt.quiz_id}`;
        if (duplicateCheck.has(key)) {
          console.warn(`DUPLICATE ATTEMPT FOUND: ${key}`);
        }
        duplicateCheck.set(key, (duplicateCheck.get(key) || 0) + 1);
      });

      // Special debug for Marf's attempts
      const marfAttempts = attemptsData?.filter(
        (a) =>
          a.student_name?.toLowerCase().includes("marf") ||
          a.user_id?.toString().includes("marf"),
      );
      if (marfAttempts && marfAttempts.length > 0) {
        console.log("=== MARF'S RAW ATTEMPTS DATA ===");
        marfAttempts.forEach((attempt, index) => {
          console.log(`Marf Attempt ${index + 1}:`, {
            quiz_id: attempt.quiz_id,
            score: attempt.score,
            student_name: attempt.student_name,
            user_id: attempt.user_id,
          });
        });
        console.log("=== END MARF RAW DATA ===");
      }

      // Special debug for James Lester Lopez's attempts
      const jamesAttempts = attemptsData?.filter((a) =>
        a.student_name?.toLowerCase().includes("james lester lopez"),
      );
      if (jamesAttempts && jamesAttempts.length > 0) {
        console.log("=== JAMES LESTER LOPEZ'S RAW ATTEMPTS DATA ===");
        jamesAttempts.forEach((attempt, index) => {
          console.log(`James Attempt ${index + 1}:`, {
            quiz_id: attempt.quiz_id,
            score: attempt.score,
            student_name: attempt.student_name,
            user_id: attempt.user_id,
            section_name: attempt.sections?.name,
          });
        });
        console.log("=== END JAMES RAW DATA ===");
      }

      // Get unique student IDs from attempts in this subject
      const uniqueStudentIds = [
        ...new Set(
          attemptsData
            ?.map((attempt) => getStudentId(attempt))
            .filter((id) => id != null),
        ),
      ];
      console.log("Unique student IDs from attempts:", uniqueStudentIds);

      // Create a map of student ID to name from quiz attempts
      const studentNameMap = new Map();
      attemptsData?.forEach((attempt) => {
        const id = getStudentId(attempt);
        if (id && !studentNameMap.has(id) && attempt.student_name) {
          studentNameMap.set(id, attempt.student_name);
        }
      });

      console.log("Student name map:", studentNameMap);

      // Fetch profiles for these students from student_profile table
      let profilesData = [];
      if (uniqueStudentIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("student_profile")
          .select(
            "id, student_name, student_email, avg_score, exam_code, student_id",
          )
          .in("id", uniqueStudentIds);

        if (profilesError) throw profilesError;
        profilesData = profiles || [];
        console.log("Unique profiles:", profilesData);
      }

      // Create a map of student ID to profile data
      const profileMap = new Map();
      profilesData?.forEach((profile) => {
        profileMap.set(profile.id, profile);
      });

      // Group attempts by student ID and quiz ID, keeping only the highest score for each quiz
      const studentAttemptsMap = new Map();
      attemptsData?.forEach((attempt) => {
        const id = getStudentId(attempt);
        if (!id) return;

        const currentScores = studentAttemptsMap.get(id) || [];

        // Check if this quiz already has an attempt for this student
        const existingQuizIndex = currentScores.findIndex(
          (s) => s.quiz_id === attempt.quiz_id,
        );

        if (existingQuizIndex >= 0) {
          // Update with higher score if this attempt is better
          if (attempt.score > currentScores[existingQuizIndex].score) {
            currentScores[existingQuizIndex].score = attempt.score;
          }
        } else {
          // Add new quiz attempt
          currentScores.push({
            score: attempt.score,
            quiz_id: attempt.quiz_id,
          });
        }

        studentAttemptsMap.set(id, currentScores);
      });

      // Debug: Log the grouped attempts to verify correct aggregation
      console.log("=== GROUPED ATTEMPTS BY STUDENT ===");
      studentAttemptsMap.forEach((scores, studentId) => {
        const studentName = studentNameMap.get(studentId);
        console.log(`Student: ${studentName} (${studentId})`);
        scores.forEach((score) => {
          console.log(`  Quiz ${score.quiz_id}: ${score.score}`);
        });
        const total = scores.reduce((sum, s) => sum + s.score, 0);
        console.log(`  Total: ${total}`);
      });
      console.log("=== END GROUPED ATTEMPTS ===");

      // Calculate final percentages and store fraction data
      const finalPercentages = new Map();
      const studentFractions = new Map();

      // Calculate total items from ALL quizzes in this subject (not just attempted ones)
      // Ensure we have valid quiz data before calculating
      let overallTotalItems = 0;
      if (quizzesData && quizzesData.length > 0) {
        overallTotalItems = quizzesData.reduce((sum, quiz) => {
          const items = quiz.total_items || 0;
          console.log(`Quiz ${quiz.title} (${quiz.id}): ${items} items`);
          return sum + items;
        }, 0);
      }

      // Debug logging to understand the issue
      console.log("DEBUG - Quizzes Data for total items calculation:");
      console.log("quizzesData:", quizzesData);
      console.log(
        "Quiz details:",
        quizzesData?.map((q) => ({
          id: q.id,
          title: q.title,
          total_items: q.total_items,
        })),
      );
      console.log("Calculated overallTotalItems:", overallTotalItems);

      // If overallTotalItems seems too low, there might be an issue with quiz data
      if (overallTotalItems < 50) {
        console.warn("WARNING: overallTotalItems seems low, check quiz data!");
      }

      studentAttemptsMap.forEach((scores, studentId) => {
        let totalScore = 0;

        // Sum scores from attempted quizzes only, ensuring no duplicates
        scores.forEach((scoreData) => {
          // Validate score is reasonable
          if (
            scoreData.score < 0 ||
            scoreData.score > 100 ||
            isNaN(scoreData.score)
          ) {
            console.warn(
              `Invalid score detected: ${scoreData.score} for quiz ${scoreData.quiz_id}`,
            );
            return;
          }
          console.log(
            `Adding score: ${scoreData.score} for quiz ${scoreData.quiz_id}`,
          );
          totalScore += scoreData.score;
        });

        // Debug: Check if totalScore is unexpectedly high
        if (totalScore > overallTotalItems) {
          console.warn(
            `WARNING: totalScore (${totalScore}) > overallTotalItems (${overallTotalItems}) for student ${studentId}`,
          );
          console.warn("Individual scores:", scores);

          // Instead of capping, let's recalculate properly by only counting valid quiz attempts
          // that match the quizzes in quizzesData
          totalScore = 0;
          scores.forEach((scoreData) => {
            const quiz = quizzesData?.find((q) => q.id === scoreData.quiz_id);
            if (quiz && quiz.total_items > 0) {
              // Ensure the score doesn't exceed the quiz's total items
              const validScore = Math.min(scoreData.score, quiz.total_items);
              totalScore += validScore;
              console.log(
                `Recalculated: Adding valid score ${validScore} for quiz ${quiz.title} (max: ${quiz.total_items})`,
              );
            } else {
              console.warn(
                `Skipping invalid quiz attempt: quiz_id ${scoreData.quiz_id} not found in quizzesData`,
              );
            }
          });

          console.log(`Recalculated totalScore: ${totalScore}`);
        }

        // Use ALL quiz items for denominator (test1 + test2 total items)
        const percentage =
          overallTotalItems > 0
            ? Math.round((totalScore / overallTotalItems) * 100)
            : 0;
        finalPercentages.set(studentId, percentage);
        studentFractions.set(studentId, {
          totalScore,
          totalItems: overallTotalItems,
        });

        // Debug logging for all students to understand the data
        const studentName = studentNameMap.get(studentId);
        console.log(`DEBUG - Student: ${studentName}`);
        console.log("Scores:", scores);
        console.log("Total Score (test1 + test2 scores):", totalScore);
        console.log(
          "Overall Total Items (test1 + test2 total items):",
          overallTotalItems,
        );
        console.log("Percentage:", percentage);
        console.log(
          "Quizzes Data:",
          quizzesData?.map((q) => ({
            id: q.id,
            title: q.title,
            total_items: q.total_items,
          })),
        );

        // Special debugging for Marf's case
        if (studentName && studentName.toLowerCase().includes("marf")) {
          console.log("=== MARF SPECIAL DEBUG ===");
          console.log("Marf's individual quiz attempts:");
          scores.forEach((scoreData, index) => {
            const quiz = quizzesData?.find((q) => q.id === scoreData.quiz_id);
            console.log(
              `  Quiz ${index + 1}: ${quiz?.title} - Score: ${scoreData.score}, Quiz ID: ${scoreData.quiz_id}`,
            );
          });
          console.log("Marf's total calculated score:", totalScore);
          console.log("Marf's total items for denominator:", overallTotalItems);
          console.log(
            "Expected calculation:",
            `${totalScore}/${overallTotalItems} = ${percentage}%`,
          );
          console.log("=== END MARF DEBUG ===");
        }

        // Special debugging for James Lester Lopez's case
        if (
          studentName &&
          studentName.toLowerCase().includes("james lester lopez")
        ) {
          console.log("=== JAMES LESTER LOPEZ SPECIAL DEBUG ===");
          console.log("James's individual quiz attempts:");
          console.log("Raw scores array:", scores);
          scores.forEach((scoreData, index) => {
            const quiz = quizzesData?.find((q) => q.id === scoreData.quiz_id);
            console.log(
              `  Quiz ${index + 1}: ${quiz?.title} - Score: ${scoreData.score}, Quiz ID: ${scoreData.quiz_id}`,
            );
          });
          console.log("James's total calculated score:", totalScore);
          console.log(
            "James's total items for denominator:",
            overallTotalItems,
          );
          console.log(
            "Expected calculation:",
            `${totalScore}/${overallTotalItems} = ${percentage}%`,
          );

          // Check if there are any issues with the calculation
          const expectedTotal = scores.reduce((sum, s) => sum + s.score, 0);
          console.log("Manual total calculation:", expectedTotal);
          if (expectedTotal !== totalScore) {
            console.error(
              "ERROR: Manual calculation doesn't match totalScore!",
            );
          }

          console.log("=== END JAMES DEBUG ===");
        }
        console.log("---");
      });

      // Create student data map
      const studentMap = new Map();

      // Process each unique student ID
      uniqueStudentIds.forEach((studentId) => {
        const profile = profileMap.get(studentId);
        const attempts = studentAttemptsMap.get(studentId) || [];
        const percentage = finalPercentages.get(studentId) || 0;
        const fraction = studentFractions.get(studentId) || {
          totalScore: 0,
          totalItems: 0,
        };

        // Use student_name from profile first, then from attempts, then fallback
        const studentName =
          profile?.student_name ||
          studentNameMap.get(studentId) ||
          `Student ${studentId}`;

        // Get section name from any attempt for this student
        const sectionName =
          attemptsData?.find((a) => getStudentId(a) === studentId)?.sections
            ?.name || "Unknown";

        studentMap.set(studentId, {
          id: studentId,
          student_name: studentName,
          section: sectionName,
          percentageScore: percentage,
          totalScore: fraction.totalScore,
          totalItems: fraction.totalItems,
          quizzes: {},
        });
      });

      // Process quiz results for each student
      studentMap.forEach((studentData, studentId) => {
        const attempts = studentAttemptsMap.get(studentId) || [];

        attempts.forEach((attempt) => {
          const quiz = quizzesData?.find((q) => q.id === attempt.quiz_id);
          if (quiz) {
            const percentage =
              quiz.total_items > 0
                ? Math.round((attempt.score / quiz.total_items) * 100)
                : 0;
            studentData.quizzes[attempt.quiz_id] = {
              name: quiz.title,
              score: attempt.score,
              totalItems: quiz.total_items,
              percentage: percentage,
              hasAttempt: true,
            };
          }
        });
      });

      // Convert to array and sort by student name
      const results = Array.from(studentMap.values()).sort((a, b) =>
        a.student_name.localeCompare(b.student_name),
      );

      console.log("Final processed results:", results);
      console.log("Calculation example - Student with partial attempts:");
      results.forEach((student) => {
        const attemptedQuizzes = Object.values(student.quizzes).filter(
          (q) => q.hasAttempt,
        ).length;
        const totalQuizzes = subjectQuizzes.length;
        console.log(
          `${student.student_name}: Attempted ${attemptedQuizzes}/${totalQuizzes} quizzes, Overall: ${student.percentageScore}%`,
        );
      });
      return results;
    } catch (err) {
      console.error("Error in getSubjectResultsForStudents:", err);
      throw err;
    }
  };

  // Calculate summary statistics based on filtered results
  const summary = useMemo(() => {
    if (filteredResults.length === 0) return { strong: 0, average: 0, weak: 0 };

    let strong = 0;
    let average = 0;
    let weak = 0;

    filteredResults.forEach((student) => {
      const overallPercentage = student.percentageScore;
      if (overallPercentage >= 80) {
        strong++;
      } else if (overallPercentage >= 60) {
        average++;
      } else {
        weak++;
      }
    });

    return { strong, average, weak };
  }, [filteredResults]);

  return (
    <div className="flex-1 overflow-auto bg-authentic-white min-h-screen">
      {/* Signature Top Hero Banner */}
      <div className="bg-gradient-to-r from-brand-navy to-brand-indigo px-6 py-8 shadow-xs border-b border-white/10 mb-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-brand-gold text-xs font-bold tracking-widest uppercase mb-1">
              INSTRUCTOR DASHBOARD
            </p>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Student Profiles
            </h1>
            <p className="text-slate-300 text-sm mt-1">
              Comprehensive student performance across quizzes, scores, and class distribution
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pb-8 space-y-6">
        {/* Selection & Filter Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
          {/* Subject Selection */}
          <div className="mb-6">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Select Subject
            </label>
            <div className="w-full sm:w-96">
              <select
                value={selectedSubject}
                onChange={(e) => {
                  setSelectedSubject(e.target.value);
                  setSelectedQuiz("");
                }}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/30 bg-white text-slate-800 shadow-2xs font-semibold text-sm transition-all"
              >
                <option value="">-- Select a Subject --</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {formatSubjectLabel(subject)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Search and Filter Section */}
          {selectedSubject && (
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                {/* Search Bar */}
                <div className="relative w-full sm:w-80">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <svg
                      className="h-4 w-4 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Search by student name..."
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/30 bg-white text-slate-800 shadow-2xs text-sm transition-all placeholder:text-slate-400"
                  />
                </div>

                {/* Filter Badges / Buttons */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-1.5">
                    Filter:
                  </span>
                  <button
                    onClick={() => setPerformanceFilter("all")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                      performanceFilter === "all"
                        ? "bg-brand-navy text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setPerformanceFilter("strong")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                      performanceFilter === "strong"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100/80"
                    }`}
                  >
                    Strong (80%+)
                  </button>
                  <button
                    onClick={() => setPerformanceFilter("average")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                      performanceFilter === "average"
                        ? "bg-amber-600 text-white shadow-xs"
                        : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100/80"
                    }`}
                  >
                    Average (60–79%)
                  </button>
                  <button
                    onClick={() => setPerformanceFilter("weak")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                      performanceFilter === "weak"
                        ? "bg-rose-600 text-white shadow-xs"
                        : "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100/80"
                    }`}
                  >
                    Weak (&lt;60%)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-700 shadow-xs flex items-center gap-3">
            <svg className="w-5 h-5 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-bold text-sm">Error</p>
              <p className="text-xs">{error}</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-12 text-center text-slate-600">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-gold"></div>
            <p className="mt-3 text-sm font-medium text-slate-500">Loading student records...</p>
          </div>
        )}

        {/* Student Profiles Table & Summary */}
        {!loading && selectedSubject && subjectResults.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-6 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-brand-navy">
                  {formatSubjectLabel(subjects.find((s) => s.id === selectedSubject))} — Student Performance Matrix
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Overview of scores per assessment and weighted class performance
                </p>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 shadow-2xs">
                <span>{filteredResults.length} {filteredResults.length === 1 ? 'Student' : 'Students'}</span>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row">
              {/* Summary Section Sidebar */}
              <div className="w-full lg:w-72 p-6 bg-slate-50/50 lg:border-r border-b lg:border-b-0 border-slate-200 flex flex-col gap-4">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                    Performance Summary
                  </h3>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200/80 rounded-xl">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                        <span className="text-emerald-800 font-bold text-xs">Strong (80%+)</span>
                      </div>
                      <span className="text-xl font-black text-emerald-700">{summary.strong}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200/80 rounded-xl">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                        <span className="text-amber-800 font-bold text-xs">Average (60–79%)</span>
                      </div>
                      <span className="text-xl font-black text-amber-700">{summary.average}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-rose-50 border border-rose-200/80 rounded-xl">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                        <span className="text-rose-800 font-bold text-xs">Weak (&lt;60%)</span>
                      </div>
                      <span className="text-xl font-black text-rose-700">{summary.weak}</span>
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Score Tiers
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center">
                      <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full mr-2"></div>
                      <span className="text-slate-600 font-medium">Strong: 80% – 100%</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-2.5 h-2.5 bg-amber-500 rounded-full mr-2"></div>
                      <span className="text-slate-600 font-medium">Average: 60% – 79%</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-2.5 h-2.5 bg-rose-500 rounded-full mr-2"></div>
                      <span className="text-slate-600 font-medium">Weak: 0% – 59%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Results Table */}
              <div className="flex-1 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead>
                      <tr className="bg-slate-50/80">
                        <th className="text-left py-3.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-500 min-w-[200px]">
                          Student Name
                        </th>
                        {subjectQuizzes.map((quiz) => (
                          <th
                            key={quiz.id}
                            className="text-center py-3.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-500 min-w-[120px]"
                          >
                            {quiz.title}
                          </th>
                        ))}
                        <th className="text-center py-3.5 px-4 text-xs font-extrabold uppercase tracking-wider text-brand-navy min-w-[150px] bg-slate-100/70">
                          Overall Average
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {paginatedResults.map((student) => (
                        <tr
                          key={student.id}
                          className="hover:bg-slate-50/60 transition-colors"
                        >
                          <td className="py-4 px-4 text-sm font-bold text-slate-800">
                            {student.student_name}
                          </td>
                          {subjectQuizzes.map((quiz) => {
                            const quizResult = student.quizzes?.[quiz.id];
                            const percentage = quizResult?.percentage || 0;
                            const score = quizResult?.score || 0;
                            const totalItems = quizResult?.totalItems || 0;
                            const hasAttempt = quizResult?.hasAttempt;

                            return (
                              <td
                                key={quiz.id}
                                className="py-4 px-4 text-center"
                              >
                                {hasAttempt ? (
                                  <div
                                    className={`inline-flex flex-col items-center justify-center px-3 py-1.5 rounded-xl text-xs font-bold w-28 shadow-2xs ${getPercentileColor(percentage)}`}
                                  >
                                    <div className="text-sm font-extrabold">
                                      {score}/{totalItems}
                                    </div>
                                    <div className="text-[10px] opacity-80 font-semibold">
                                      {percentage}%
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-slate-300 text-xs italic font-medium">
                                    No attempt
                                  </span>
                                )}
                              </td>
                            );
                          })}
                          <td className="py-4 px-4 text-center bg-slate-50/40">
                            <div
                              className={`inline-flex flex-col items-center justify-center px-3.5 py-1.5 rounded-xl text-xs font-black w-32 shadow-2xs ${getPercentileColor(student.percentageScore)}`}
                            >
                              <div className="text-sm font-extrabold">
                                {student.totalScore}/{student.totalItems}
                              </div>
                              <div className="text-[10px] font-bold opacity-90">
                                {student.percentageScore}%
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-200">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs font-semibold text-slate-600">
                    Showing <strong className="text-slate-800">{(currentPage - 1) * studentsPerPage + 1}</strong> to{" "}
                    <strong className="text-slate-800">{Math.min(currentPage * studentsPerPage, filteredResults.length)}</strong> of{" "}
                    <strong className="text-slate-800">{filteredResults.length}</strong> students
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition-all"
                    >
                      Previous
                    </button>

                    <div className="flex items-center space-x-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                        if (
                          page === 1 ||
                          page === totalPages ||
                          (page >= currentPage - 1 && page <= currentPage + 1)
                        ) {
                          return (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`w-8 h-8 text-xs font-bold rounded-xl transition-all ${
                                currentPage === page
                                  ? "bg-brand-navy text-white shadow-xs"
                                  : "text-slate-600 hover:bg-slate-200/70"
                              }`}
                            >
                              {page}
                            </button>
                          );
                        } else if (
                          page === currentPage - 2 ||
                          page === currentPage + 2
                        ) {
                          return (
                            <span
                              key={page}
                              className="w-6 text-center text-xs font-bold text-slate-400"
                            >
                              ...
                            </span>
                          );
                        }
                        return null;
                      })}
                    </div>

                    <button
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition-all"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty State when no subject selected */}
        {!loading && !selectedSubject && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-brand-navy/5 text-brand-navy flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-brand-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-brand-navy mb-1">Select a Subject</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Please choose a subject from the dropdown above to view student profiles and performance statistics.
            </p>
          </div>
        )}

        {/* Empty State when subject selected but no results */}
        {!loading && selectedSubject && subjectResults.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-brand-navy mb-1">No Student Records Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              There are no student attempts or quiz records available for the selected subject yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
