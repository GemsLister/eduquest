import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../supabaseClient.js";

export const StudentProfiles = () => {
  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState(null);

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
          .select("*")
          .eq("instructor_id", user.id)
          .eq("is_archived", false)
          .order("name", { ascending: true });

        if (sectionsError) {
          console.error("Error fetching sections:", sectionsError);
          setSubjects([]);
        } else {
          setSubjects(sectionsData || []);
        }
        
        // Don't load students initially - load them when subject is selected
        setStudents([]);

      } catch (err) {
        setError(err.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Calculate percentile for a score
  const calculatePercentile = (score, allScores) => {
    if (!allScores || allScores.length === 0) return 0;
    
    const sortedScores = [...allScores].sort((a, b) => a - b);
    
    // Count how many scores are less than the current score
    const lowerScores = sortedScores.filter(s => s < score);
    // Count how many scores are equal to the current score
    const equalScores = sortedScores.filter(s => s === score);
    
    // Calculate percentile: (lower scores + half of equal scores) / total scores
    const percentile = ((lowerScores.length + equalScores.length * 0.5) / sortedScores.length) * 100;
    
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
    return subjectResults.filter(student =>
      student.student_name.toLowerCase().includes(studentSearch.toLowerCase())
    );
  }, [subjectResults, studentSearch]);

  // Update results when subject changes
  useEffect(() => {
    if (selectedSubject) {
      const fetchResults = async () => {
        setLoading(true);
        try {
          // Fetch quiz attempts for this subject first to see which quizzes have results
          const { data: attemptsData, error: attemptsError } = await supabase
            .from("quiz_attempts")
            .select("quiz_id")
            .eq("section_id", selectedSubject);

          if (attemptsError) throw attemptsError;

          // Get unique quiz IDs that have attempts in this subject
          const quizIdsWithAttempts = [...new Set(attemptsData?.map(a => a.quiz_id).filter(id => id != null))];
          
          let allQuizzes = [];
          if (quizIdsWithAttempts.length > 0) {
            // Fetch these quizzes, but only if they are not archived
            const { data: quizzesData, error: quizzesError } = await supabase
              .from("quizzes")
              .select("id, title, is_archived, created_at")
              .in("id", quizIdsWithAttempts)
              .neq("is_archived", true);
            
            if (quizzesError) throw quizzesError;
            
            // Get question counts for each quiz to use as total_items
            const quizzesWithCounts = await Promise.all((quizzesData || []).map(async (quiz) => {
              const { count } = await supabase
                .from("questions")
                .select("*", { count: 'exact', head: true })
                .eq("quiz_id", quiz.id);
              return { ...quiz, total_items: count || 0 };
            }));
            
            allQuizzes = quizzesWithCounts;
          }

          // Also check for any active quizzes assigned to this section that might not have attempts yet
          // 1. Direct assignment
          const { data: directQuizzesData } = await supabase
            .from("quizzes")
            .select("id, title, is_archived, created_at")
            .eq("section_id", selectedSubject)
            .neq("is_archived", true);
          
          if (directQuizzesData) {
            const directWithCounts = await Promise.all(directQuizzesData.map(async (quiz) => {
              const { count } = await supabase
                .from("questions")
                .select("*", { count: 'exact', head: true })
                .eq("quiz_id", quiz.id);
              return { ...quiz, total_items: count || 0 };
            }));

            directWithCounts.forEach(dq => {
              if (!allQuizzes.find(aq => aq.id === dq.id)) {
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
            const mIds = mappedQuizIds.map(mq => mq.quiz_id);
            const { data: mappedQuizzesData } = await supabase
              .from("quizzes")
              .select("id, title, is_archived, created_at")
              .in("id", mIds)
              .neq("is_archived", true);
            
            if (mappedQuizzesData) {
              const mappedWithCounts = await Promise.all(mappedQuizzesData.map(async (quiz) => {
                const { count } = await supabase
                  .from("questions")
                  .select("*", { count: 'exact', head: true })
                  .eq("quiz_id", quiz.id);
                return { ...quiz, total_items: count || 0 };
              }));

              mappedWithCounts.forEach(mq => {
                if (!allQuizzes.find(aq => aq.id === mq.id)) {
                  allQuizzes.push(mq);
                }
              });
            }
          }

          allQuizzes.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

          console.log("Unified active quizzes for subject:", allQuizzes);
          setSubjectQuizzes(allQuizzes);

          const results = await getSubjectResultsForStudents([], allQuizzes);
          setSubjectResults(results);
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
    }
  }, [selectedSubject]);

  // Helper function to get results for specific students
  const getSubjectResultsForStudents = async (studentsToProcess, quizzesData) => {
    if (selectedSubject === "") return [];

    try {
      // Fetch quiz attempts for this specific subject
      const { data: attemptsData, error: attemptsError } = await supabase
        .from("quiz_attempts")
        .select(`
          user_id,
          student_id,
          student_name,
          quiz_id, 
          score,
          sections!inner(name)
        `)
        .eq("section_id", selectedSubject);

      if (attemptsError) throw attemptsError;

      console.log("All quiz attempts for subject:", attemptsData);

      // Unified helper to get a student's identification
      const getStudentId = (attempt) => attempt.user_id || attempt.student_id;

      // Get unique student IDs from attempts in this subject
      const uniqueStudentIds = [...new Set(attemptsData?.map(attempt => getStudentId(attempt)).filter(id => id != null))];
      console.log("Unique student IDs from attempts:", uniqueStudentIds);
      
      // Create a map of student ID to name from quiz attempts
      const studentNameMap = new Map();
      attemptsData?.forEach(attempt => {
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
          .select("id, student_name, student_email, avg_score, exam_code, student_id")
          .in("id", uniqueStudentIds);

        if (profilesError) throw profilesError;
        profilesData = profiles || [];
        console.log('Unique profiles:', profilesData);
      }

      // Create a map of student ID to profile data
      const profileMap = new Map();
      profilesData?.forEach(profile => {
        profileMap.set(profile.id, profile);
      });

      // Group attempts by student ID
      const studentAttemptsMap = new Map();
      attemptsData?.forEach(attempt => {
        const id = getStudentId(attempt);
        if (!id) return;

        const currentScores = studentAttemptsMap.get(id) || [];
        currentScores.push({
          score: attempt.score,
          quiz_id: attempt.quiz_id
        });
        studentAttemptsMap.set(id, currentScores);
      });

      // Calculate final percentages
      const finalPercentages = new Map();
      studentAttemptsMap.forEach((scores, studentId) => {
        let totalScore = 0;
        let totalItems = 0;
        
        scores.forEach(scoreData => {
          const quiz = quizzesData?.find(q => q.id === scoreData.quiz_id);
          if (quiz) {
            totalScore += scoreData.score;
            totalItems += quiz.total_items || 1;
          }
        });
        
        const percentage = totalItems > 0 ? Math.round((totalScore / totalItems) * 100) : 0;
        finalPercentages.set(studentId, percentage);
      });

      // Create student data map
      const studentMap = new Map();

      attemptsData?.forEach(attempt => {
        const studentId = getStudentId(attempt);
        if (!studentId || studentMap.has(studentId)) return;

        // First try to get name from quiz attempts, then from profile
        const nameFromAttempt = studentNameMap.get(studentId);
        const profile = profileMap.get(studentId);
        
        let fullName = `Student ${studentId}`; // fallback
        
        if (nameFromAttempt) {
          fullName = nameFromAttempt.trim();
        } else if (profile?.student_name) {
          fullName = profile.student_name.trim();
        } else if (profile?.username) {
          fullName = profile.username.trim();
        } else if (profile?.student_email) {
          fullName = profile.student_email.split('@')[0];
        }
        
        studentMap.set(studentId, {
          id: studentId,
          name: fullName,
          student_name: fullName,
          percentageScore: finalPercentages.get(studentId) || 0,
          section: attempt.sections?.name || "Unknown"
        });
      });

      const studentsFromSubject = Array.from(studentMap.values());

      // Process results
      const results = studentsFromSubject.map(student => {
        const studentResults = {
          ...student,
          quizzes: {}
        };

        quizzesData?.forEach(quiz => {
          const studentQuizAttempts = attemptsData?.filter(
            attempt => attempt.quiz_id === quiz.id && getStudentId(attempt) === student.id
          );
          
          const hasAttempt = studentQuizAttempts && studentQuizAttempts.length > 0;
          const bestAttempt = hasAttempt ? studentQuizAttempts.reduce((best, current) => 
            (current.score > best.score) ? current : best, studentQuizAttempts[0]
          ) : null;

          const score = bestAttempt?.score || 0;
          const totalItems = quiz.total_items || 1;
          const percentage = Math.round((score / totalItems) * 100);
          
          studentResults.quizzes[quiz.id] = {
            name: quiz.title,
            score: score,
            totalItems: totalItems,
            percentage: percentage,
            hasAttempt: hasAttempt
          };
        });

        return studentResults;
      });

      console.log("Final student results with quiz data before filtering:", results);
      
      // Filter out students who have no attempts for the active quizzes
      const filteredResults = results.filter(student => {
        return quizzesData?.some(quiz => {
          return attemptsData?.some(attempt => 
            getStudentId(attempt) === student.id && attempt.quiz_id === quiz.id
          );
        });
      });

      console.log("Final student results after filtering archived quiz data:", filteredResults);
      console.log("Subject quizzes being used for display:", quizzesData);
      return filteredResults;

    } catch (err) {
      console.error("Error fetching subject results:", err);
      return [];
    }
  };

  // Calculate summary statistics based on filtered results
  const summary = useMemo(() => {
    if (filteredResults.length === 0) return { strong: 0, average: 0, weak: 0 };

    let strong = 0;
    let average = 0;
    let weak = 0;

    filteredResults.forEach(student => {
      Object.values(student.quizzes).forEach(quiz => {
        if (quiz.hasAttempt) {
          const percentage = quiz.percentage;
          if (percentage >= 80) {
            strong++;
          } else if (percentage >= 60) {
            average++;
          } else {
            weak++;
          }
        }
      });
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
              Student Profiles
            </h1>
            <p className="opacity-80 text-sm">
              View student performance across subjects and quizzes
            </p>
          </div>
        </div>

        {/* Selection Controls */}
        <div className="p-6 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            {/* Subject Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select Subject
              </label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">-- Select a Subject --</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name || subject.section_name}
                  </option>
                ))}
              </select>
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
            <p className="mt-2">Loading student data...</p>
          </div>
        </div>
      )}

      {/* Results Table */}
      {!loading && selectedSubject && filteredResults.length > 0 && (
        <div className="px-6 pb-6">
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="p-6 bg-gray-50 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">
                {subjects.find(s => s.id === selectedSubject)?.name || subjects.find(s => s.id === selectedSubject)?.section_name} - Quiz Results
              </h2>
            </div>

            <div className="flex">
              {/* Summary Section */}
              <div className="w-64 p-6 bg-gray-50 border-r border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Summary</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-green-100 rounded-lg">
                    <span className="text-green-800 font-semibold">Strong</span>
                    <span className="text-2xl font-bold text-green-600">{summary.strong}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-orange-100 rounded-lg">
                    <span className="text-orange-800 font-semibold">Average</span>
                    <span className="text-2xl font-bold text-orange-600">{summary.average}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-red-100 rounded-lg">
                    <span className="text-red-800 font-semibold">Weak</span>
                    <span className="text-2xl font-bold text-red-600">{summary.weak}</span>
                  </div>
                </div>
              </div>

              {/* Results Table */}
              <div className="flex-1 p-6">
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left py-4 px-4 text-sm font-semibold text-gray-600 w-48">
                          Student Name
                        </th>
                        {/* <th className="text-left py-4 px-4 text-sm font-semibold text-gray-600 w-64">
                          Section
                        </th> */}
                        {subjectQuizzes.map((quiz) => (
                          <th key={quiz.id} className="text-center py-4 px-4 text-sm font-semibold text-gray-600 min-w-[140px]">
                            {quiz.title}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredResults.map((student) => (
                        <tr key={student.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-6 px-4 text-sm font-bold text-gray-800">
                            {student.student_name}
                          </td>
                          {/* <td className="py-6 px-4 text-xs text-gray-500 max-w-[200px] leading-relaxed">
                            {student.section}
                          </td> */}
                          {subjectQuizzes.map((quiz) => {
                            const quizResult = student.quizzes?.[quiz.id];
                            const percentage = quizResult?.percentage || 0;
                            const hasAttempt = quizResult?.hasAttempt;
                            
                            return (
                              <td key={quiz.id} className="py-6 px-4 text-center">
                                {hasAttempt ? (
                                  <div className={`inline-flex items-center justify-center px-8 py-2 rounded-lg text-sm font-bold w-32 ${getPercentileColor(percentage)}`}>
                                    {percentage}%
                                  </div>
                                ) : (
                                  <div className="text-gray-300 text-xs italic">No attempt</div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !selectedSubject && (
        <div className="px-6 pb-6">
          <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-600">
            Select a subject to view student performance data
          </div>
        </div>
      )}

      {!loading && selectedSubject && subjectResults.length === 0 && (
        <div className="px-6 pb-6">
          <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-600">
            No students have attempted quizzes in this subject yet
          </div>
        </div>
      )}
    </div>
  );
};
