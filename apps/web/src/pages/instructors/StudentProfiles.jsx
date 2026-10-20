import { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../../supabaseClient.js";
import { Skeleton, SkeletonTableRow } from "../../components/ui/Skeleton.jsx";

export const StudentProfiles = () => {
  const location = useLocation();
  const isAdminPath = location.pathname.startsWith("/admin-dashboard");
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [error, setError] = useState("");
  const [performanceFilter, setPerformanceFilter] = useState("all"); // all, strong, average, weak

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const studentsPerPage = 10;


  const formatSubjectLabel = (subject) => {
    if (!subject) return "";
    const name = String(subject.name || subject.section_name || "").trim();
    const code = String(subject.description || "").trim();

    return code ? `${name} ${code}`.trim() : name;
  };

  // Fetch the instructor's sections on mount
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
        setLoading(true);

        const { data: sectionsData, error: sectionsError } = await supabase
          .from("sections")
          .select("id, name, description")
          .eq("instructor_id", user.id)
          .eq("is_archived", false)
          .order("name", { ascending: true });

        if (sectionsError) throw sectionsError;

        setSubjects(sectionsData || []);
      } catch (err) {
        setError(err.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

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

  // Reset to page 1 when the search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [studentSearch, performanceFilter, selectedSubject]);

  // Total possible points per quiz (sum of active question points)
  const fetchQuizPoints = async (quizIds) => {
    const pointsByQuiz = new Map();
    if (quizIds.length === 0) return pointsByQuiz;
    const { data: questionRows } = await supabase
      .from("questions")
      .select("quiz_id, points")
      .in("quiz_id", quizIds)
      .or("is_archived.is.null,is_archived.eq.false");
    (questionRows || []).forEach((q) => {
      pointsByQuiz.set(q.quiz_id, (pointsByQuiz.get(q.quiz_id) || 0) + (q.points || 1));
    });
    return pointsByQuiz;
  };

  // Update results when the section changes
  useEffect(() => {
    if (!selectedSubject) {
      setSubjectResults([]);
      setSubjectQuizzes([]);
      return;
    }

    const fetchResults = async () => {
      setResultsLoading(true);
      setError("");
      try {
        // Published, non-archived quizzes assigned to this section
        const [{ data: directQuizzes }, { data: mappedRows }] = await Promise.all([
          supabase
            .from("quizzes")
            .select("id")
            .eq("section_id", selectedSubject),
          supabase
            .from("quiz_sections")
            .select("quiz_id")
            .eq("section_id", selectedSubject),
        ]);

        const candidateIds = [
          ...new Set([
            ...(directQuizzes || []).map((q) => q.id),
            ...(mappedRows || []).map((r) => r.quiz_id),
          ]),
        ].filter(Boolean);

        let allQuizzes = [];
        if (candidateIds.length > 0) {
          const { data: quizzesData, error: quizzesError } = await supabase
            .from("quizzes")
            .select("id, title, created_at")
            .in("id", candidateIds)
            .eq("is_published", true)
            .or("is_archived.is.null,is_archived.eq.false");
          if (quizzesError) throw quizzesError;

          const pointsByQuiz = await fetchQuizPoints((quizzesData || []).map((q) => q.id));
          allQuizzes = (quizzesData || []).map((quiz) => ({
            ...quiz,
            total_items: pointsByQuiz.get(quiz.id) || 0,
          }));
        }

        allQuizzes.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        setSubjectQuizzes(allQuizzes);

        const results = await getSubjectResultsForStudents(allQuizzes);
        setSubjectResults(results);
      } catch (err) {
        setError(err.message || "Failed to load results");
      } finally {
        setResultsLoading(false);
      }
    };

    fetchResults();
  }, [selectedSubject]);

  // Builds one row per student with their best score on each published quiz.
  // The overall percentage is earned points / total possible points across
  // every published quiz in the section (a missed quiz counts as 0).
  const getSubjectResultsForStudents = async (quizzesData) => {
    if (selectedSubject === "") return [];

    const quizMap = new Map(quizzesData.map((q) => [q.id, q]));
    if (quizMap.size === 0) return [];

    const { data: attemptsData, error: attemptsError } = await supabase
      .from("quiz_attempts")
      .select("user_id, student_id, student_name, quiz_id, score, status, sections!inner(name)")
      .eq("section_id", selectedSubject)
      .eq("status", "completed")
      .in("quiz_id", [...quizMap.keys()]);

    if (attemptsError) throw attemptsError;

    const getStudentId = (attempt) => attempt.user_id || attempt.student_id;

    const uniqueStudentIds = [
      ...new Set((attemptsData || []).map(getStudentId).filter((id) => id != null)),
    ];

    const studentNameMap = new Map();
    (attemptsData || []).forEach((attempt) => {
      const id = getStudentId(attempt);
      if (id && !studentNameMap.has(id) && attempt.student_name) {
        studentNameMap.set(id, attempt.student_name);
      }
    });

    const profileMap = new Map();
    if (uniqueStudentIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from("student_profile")
        .select("id, student_name, student_email, avg_score, exam_code, student_id")
        .in("id", uniqueStudentIds);
      if (profilesError) throw profilesError;
      (profiles || []).forEach((profile) => profileMap.set(profile.id, profile));
    }

    // Best score per student per quiz
    const bestScores = new Map();
    (attemptsData || []).forEach((attempt) => {
      const id = getStudentId(attempt);
      if (!id) return;
      const perQuiz = bestScores.get(id) || new Map();
      const score = Number(attempt.score) || 0;
      if (!perQuiz.has(attempt.quiz_id) || score > perQuiz.get(attempt.quiz_id)) {
        perQuiz.set(attempt.quiz_id, score);
      }
      bestScores.set(id, perQuiz);
    });

    const overallTotalPoints = quizzesData.reduce((sum, q) => sum + (q.total_items || 0), 0);

    const results = uniqueStudentIds.map((studentId) => {
      const perQuiz = bestScores.get(studentId) || new Map();
      let totalScore = 0;
      const quizzes = {};

      perQuiz.forEach((score, quizId) => {
        const quiz = quizMap.get(quizId);
        if (!quiz) return;
        const capped = quiz.total_items > 0 ? Math.min(score, quiz.total_items) : score;
        totalScore += capped;
        quizzes[quizId] = {
          name: quiz.title,
          score: capped,
          totalItems: quiz.total_items,
          percentage: quiz.total_items > 0 ? Math.round((capped / quiz.total_items) * 100) : 0,
          hasAttempt: true,
        };
      });

      const profile = profileMap.get(studentId);
      const sectionName =
        (attemptsData || []).find((a) => getStudentId(a) === studentId)?.sections?.name || "Unknown";

      return {
        id: studentId,
        student_name: profile?.student_name || studentNameMap.get(studentId) || "Unnamed student",
        section: sectionName,
        percentageScore:
          overallTotalPoints > 0 ? Math.round((totalScore / overallTotalPoints) * 100) : 0,
        totalScore,
        totalItems: overallTotalPoints,
        quizzes,
      };
    });

    return results.sort((a, b) => a.student_name.localeCompare(b.student_name));
  };

  // Calculate summary statistics based on filtered results
  const summary = useMemo(() => {
    const searched = studentSearch
      ? subjectResults.filter((student) =>
          student.student_name.toLowerCase().includes(studentSearch.toLowerCase()),
        )
      : subjectResults;
    if (searched.length === 0) return { strong: 0, average: 0, weak: 0 };

    let strong = 0;
    let average = 0;
    let weak = 0;

    searched.forEach((student) => {
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
  }, [subjectResults, studentSearch]);

  if (loading) {
    return (
      <div className="flex-1 overflow-auto bg-authentic-white min-h-screen" aria-label="Loading student profiles">
        <div className="bg-gradient-to-r from-brand-navy to-brand-indigo px-6 py-8 shadow-xs border-b border-white/10 mb-6">
          <div className="max-w-7xl mx-auto">
            <Skeleton tone="bg-white/20" className="h-4 w-44 rounded-md mb-2" />
            <Skeleton tone="bg-white/20" className="h-8 w-56 max-w-full rounded-md mb-2" />
            <Skeleton tone="bg-white/20" className="h-4 w-96 max-w-full rounded-md" />
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 pb-8 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
            <Skeleton className="h-11 w-96 max-w-full rounded-lg" />
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <SkeletonTableRow cells={5} />
            <SkeletonTableRow cells={5} />
            <SkeletonTableRow cells={5} />
            <SkeletonTableRow cells={5} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-authentic-white min-h-screen">
      {/* Signature Top Hero Banner */}
      <div className="bg-gradient-to-r from-brand-navy to-brand-indigo px-6 py-8 shadow-xs border-b border-white/10 mb-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-brand-gold text-sm font-semibold tracking-widest uppercase mb-1">
              {isAdminPath ? "Senior Faculty" : "Instructor Portal"}
            </p>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              Student Profiles
            </h1>
            <p className="text-white/60 text-sm mt-1">
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
            <label htmlFor="sp-subject" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Select Section
            </label>
            <div className="w-full sm:w-96">
              <select
                id="sp-subject"
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 bg-white text-slate-800 shadow-2xs font-semibold text-sm transition-all"
              >
                <option value="">-- Select a Section --</option>
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
                  <label htmlFor="sp-search" className="sr-only">
                    Search by student name
                  </label>
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
                    id="sp-search"
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Search by student name..."
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 bg-white text-slate-800 shadow-2xs text-sm transition-all placeholder:text-slate-400"
                  />
                </div>

                {/* Filter Badges / Buttons */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-1.5">
                    Filter:
                  </span>
                  <button
                    onClick={() => setPerformanceFilter("all")}
                    aria-pressed={performanceFilter === "all"}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 ${
                      performanceFilter === "all"
                        ? "bg-brand-navy text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setPerformanceFilter("strong")}
                    aria-pressed={performanceFilter === "strong"}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 ${
                      performanceFilter === "strong"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100/80"
                    }`}
                  >
                    Strong (80%+)
                  </button>
                  <button
                    onClick={() => setPerformanceFilter("average")}
                    aria-pressed={performanceFilter === "average"}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 ${
                      performanceFilter === "average"
                        ? "bg-amber-600 text-white shadow-xs"
                        : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100/80"
                    }`}
                  >
                    Average (60–79%)
                  </button>
                  <button
                    onClick={() => setPerformanceFilter("weak")}
                    aria-pressed={performanceFilter === "weak"}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 ${
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

        {resultsLoading && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden" aria-label="Loading student results">
            <SkeletonTableRow cells={5} />
            <SkeletonTableRow cells={5} />
            <SkeletonTableRow cells={5} />
          </div>
        )}

        {/* Student Profiles Table & Summary */}
        {!loading && !resultsLoading && selectedSubject && subjectResults.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-6 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-brand-navy">
                  {formatSubjectLabel(subjects.find((s) => s.id === selectedSubject))} — Student Performance Matrix
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Best score per quiz (points) and overall score across all published quizzes in this section
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
                      aria-label="Previous page"
                      className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
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
                              aria-label={`Go to page ${page}`}
                              aria-current={currentPage === page ? "page" : undefined}
                              className={`w-8 h-8 text-xs font-bold rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 ${
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
                      aria-label="Next page"
                      className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
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
            <h3 className="text-base font-bold text-brand-navy mb-1">Select a Section</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Choose one of your sections above to view student profiles and performance statistics.
            </p>
          </div>
        )}

        {/* Empty State when subject selected but no results */}
        {!loading && !resultsLoading && selectedSubject && subjectResults.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-brand-navy mb-1">No Student Records Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              There are no completed attempts on published quizzes for this section yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
