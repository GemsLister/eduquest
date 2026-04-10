import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../supabaseClient.js";
import { useAuth } from "../../context/AuthContext.jsx";

export const StudentProfiles = () => {
  const { user: authUser } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState(null);

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
    const code = String(
      subject.description || subject.section_code || "",
    ).trim();

    if (!code) {
      return name.length > 64 ? `${name.slice(0, 61)}...` : name;
    }

    const maxTotal = 64;
    const reservedForCode = Math.min(code.length + 1, 20);
    const maxNameLength = Math.max(16, maxTotal - reservedForCode);
    const shortName =
      name.length > maxNameLength
        ? `${name.slice(0, maxNameLength - 3)}...`
        : name;

    return `${shortName} ${code}`.trim();
  };

  // Fetch subjects and students on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!authUser) {
          setError("User not authenticated");
          setLoading(false);
          return;
        }
        setUserId(authUser.id);

        setLoading(true);

        // Fetch instructor's active sections (subjects)
        const { data: sectionsData, error: sectionsError } = await supabase
          .from("sections")
          .select("*")
          .eq("instructor_id", authUser.id)
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
    if (percentile >= 80) return "text-green-700 bg-green-100";
    if (percentile >= 60) return "text-orange-700 bg-orange-100";
    return "text-red-700 bg-red-100";
  };

  // State for subject results
  const [subjectResults, setSubjectResults] = useState([]);
  const [subjectQuizzes, setSubjectQuizzes] = useState([]);

  // Filter student results based on search
  const filteredResults = useMemo(() => {
    if (!studentSearch) return subjectResults;
    return subjectResults.filter(
      (student) =>
        student.student_name.toLowerCase() === studentSearch.toLowerCase(),
    );
  }, [subjectResults, studentSearch]);

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
            // Fetch these quizzes, but only if they are not archived
            const { data: quizzesData, error: quizzesError } = await supabase
              .from("quizzes")
              .select("id, title, is_archived, created_at")
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
            .select("id, title, is_archived, created_at")
            .eq("section_id", selectedSubject)
            .eq("is_published", true)
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
              .select("id, title, is_archived, created_at")
              .in("id", mIds)
              .eq("is_published", true)
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
    <div className="flex-1 overflow-auto bg-authentic-white">
      {/* Header */}
      <div className="bg-white shadow-lg rounded-xl overflow-hidden mb-6">
        <div className="p-6 bg-brand-navy text-white">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-wider">
              Student Profiles & Item Analysis
            </h1>
            <p className="opacity-80 text-sm">
              View student performance and item analysis results
            </p>
          </div>
        </div>

        {/* Selection Controls */}
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Subject Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select Subject
              </label>
              <select
                value={selectedSubject}
                onChange={(e) => {
                  setSelectedSubject(e.target.value);
                  setSelectedQuiz("");
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">-- Select a Subject --</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {formatSubjectLabel(subject)}
                  </option>
                ))}
              </select>
            </div>

            {/* Student Search Bar */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Search Students
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Search by student name..."
                  className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
                <svg
                  className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
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
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-600">
          <p className="font-semibold">Error</p>
          <p>{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="px-6 pb-6">
          <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-600">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-gold"></div>
            <p className="mt-2">Loading data...</p>
          </div>
        </div>
      )}

      {/* Item Analysis Results */}
      {!loading && selectedQuiz && analysis.length > 0 && (
        <div className="px-6 pb-6">
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="p-6 bg-gray-50 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">
                Item Analysis Results -{" "}
                {quizzes.find((q) => q.id === selectedQuiz)?.title}
              </h2>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  Binary Analysis Results
                </h3>
                <div className="bg-gray-100 rounded-lg p-4 font-mono text-sm max-h-64 overflow-y-auto">
                  {analysis.map((item, index) => (
                    <div key={index} className="mb-2 flex items-center">
                      <span className="text-gray-600 mr-4">
                        Q{String(index + 1).padStart(2, "0")}:
                      </span>
                      <span className="font-bold text-gray-800">
                        {item.question_id}
                      </span>
                      <span className="text-blue-600 ml-4">
                        {item.auto_flag}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Difficulty Analysis */}
                <div>
                  <h4 className="text-md font-semibold text-gray-800 mb-4">
                    Difficulty Analysis
                  </h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {analysis.map((item, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center p-3 bg-gray-50 rounded"
                      >
                        <span className="text-sm text-gray-600">
                          Q{String(index + 1).padStart(2, "0")}
                        </span>
                        <span
                          className={`px-3 py-1 rounded text-xs font-semibold ${
                            item.difficulty_status === "Easy"
                              ? "bg-green-100 text-green-800"
                              : item.difficulty_status === "Moderate"
                                ? "bg-orange-100 text-orange-800"
                                : item.difficulty_status === "Difficult"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {item.difficulty_status || "N/A"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Discrimination Analysis */}
                <div>
                  <h4 className="text-md font-semibold text-gray-800 mb-4">
                    Discrimination Analysis
                  </h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {analysis.map((item, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center p-3 bg-gray-50 rounded"
                      >
                        <span className="text-sm text-gray-600">
                          Q{String(index + 1).padStart(2, "0")}
                        </span>
                        <span
                          className={`px-3 py-1 rounded text-xs font-semibold ${
                            item.discrimination_status === "Excellent"
                              ? "bg-green-100 text-green-800"
                              : item.discrimination_status === "Good"
                                ? "bg-blue-100 text-blue-800"
                                : item.discrimination_status === "Acceptable"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : item.discrimination_status === "Poor"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {item.discrimination_status || "N/A"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Student Profiles Table */}
      {!loading && selectedSubject && subjectResults.length > 0 && (
        <div className="px-6 pb-6">
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="p-6 bg-gray-50 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">
                {subjects.find((s) => s.id === selectedSubject)?.name ||
                  subjects.find((s) => s.id === selectedSubject)
                    ?.section_name}{" "}
                - Student Profiles
              </h2>
            </div>

            <div className="flex">
              {/* Summary Section */}
              <div className="w-64 p-6 bg-gray-50 border-r border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  Summary
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-green-100 rounded-lg">
                    <span className="text-green-800 font-semibold">Strong</span>
                    <span className="text-2xl font-bold text-green-600">
                      {summary.strong}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-orange-100 rounded-lg">
                    <span className="text-orange-800 font-semibold">
                      Average
                    </span>
                    <span className="text-2xl font-bold text-orange-600">
                      {summary.average}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-red-100 rounded-lg">
                    <span className="text-red-800 font-semibold">Weak</span>
                    <span className="text-2xl font-bold text-red-600">
                      {summary.weak}
                    </span>
                  </div>
                </div>

                {/* Legend */}
                <div className="mt-6 p-3 bg-white rounded-lg border border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">
                    Performance Legend
                  </h4>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                      <span className="text-gray-600">Strong: 80% - 100%</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-orange-500 rounded-full mr-2"></div>
                      <span className="text-gray-600">Average: 60% - 79%</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                      <span className="text-gray-600">Weak: 0% - 59%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Results Table */}
              <div className="flex-1 p-6">
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 w-48">
                          Student Name
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 w-32">
                          Section
                        </th>
                        {subjectQuizzes.map((quiz) => (
                          <th
                            key={quiz.id}
                            className="text-center py-3 px-4 text-sm font-semibold text-gray-700 min-w-[80px]"
                          >
                            {quiz.title}
                          </th>
                        ))}
                        <th className="text-center py-4 px-4 text-sm font-bold text-brand-navy min-w-[140px] bg-gray-100/50">
                          Overall Average
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paginatedResults.map((student) => (
                        <tr
                          key={student.id}
                          className="hover:bg-gray-50/50 transition-colors"
                        >
                          <td className="py-6 px-4 text-sm font-bold text-gray-800">
                            {student.student_name}
                          </td>
                          <td className="py-6 px-4 text-xs text-gray-500 max-w-[200px] leading-relaxed">
                            {student.section}
                          </td>
                          {subjectQuizzes.map((quiz) => {
                            const quizResult = student.quizzes?.[quiz.id];
                            const percentage = quizResult?.percentage || 0;
                            const hasAttempt = quizResult?.hasAttempt;

                            return (
                              <td
                                key={quiz.id}
                                className="py-6 px-4 text-center"
                              >
                                {hasAttempt ? (
                                  <div
                                    className={`inline-flex items-center justify-center px-8 py-2 rounded-lg text-sm font-bold w-32 ${getPercentileColor(percentage)}`}
                                  >
                                    {percentage}%
                                  </div>
                                ) : (
                                  <div className="text-gray-300 text-xs italic">
                                    No attempt
                                  </div>
                                )}
                              </td>
                            );
                          })}
                          <td className="py-6 px-4 text-center bg-gray-50/30">
                            <div
                              className={`inline-flex flex-col items-center justify-center px-4 py-2 rounded-lg text-sm font-black w-40 shadow-sm ${getPercentileColor(student.percentageScore)}`}
                            >
                              <div className="text-lg font-bold">
                                {student.totalScore}/{student.totalItems}
                              </div>
                              <div className="text-xs">
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
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Showing {(currentPage - 1) * studentsPerPage + 1} to{" "}
                    {Math.min(
                      currentPage * studentsPerPage,
                      filteredResults.length,
                    )}{" "}
                    of {filteredResults.length} students
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(prev - 1, 1))
                      }
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-3 py-2 text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>

                    {/* Page Numbers */}
                    <div className="flex space-x-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                        (page) => {
                          // Show first page, last page, current page, and pages around current
                          if (
                            page === 1 ||
                            page === totalPages ||
                            (page >= currentPage - 1 && page <= currentPage + 1)
                          ) {
                            return (
                              <button
                                key={page}
                                onClick={() => setCurrentPage(page)}
                                className={`relative inline-flex items-center px-3 py-2 text-sm font-semibold rounded-md ${
                                  currentPage === page
                                    ? "z-10 bg-indigo-600 text-white"
                                    : "text-gray-900 bg-white border border-gray-300 hover:bg-gray-50"
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
                                className="relative inline-flex items-center px-3 py-2 text-sm font-semibold text-gray-700"
                              >
                                ...
                              </span>
                            );
                          }
                          return null;
                        },
                      )}
                    </div>

                    <button
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                      }
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-3 py-2 text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !selectedSubject && !selectedQuiz && (
        <div className="px-6 pb-6">
          <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-600">
            Select a subject to view student performance data or a quiz to view
            item analysis
          </div>
        </div>
      )}
    </div>
  );
};
