import { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient.js";

export const StudentProfiles = () => {
  const [sections, setSections] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedQuiz, setSelectedQuiz] = useState("");
  const [studentsData, setStudentsData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingSections, setLoadingSections] = useState(true);
  const [loadingQuizzes, setLoadingQuizzes] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState(null);
  const [expandedStudent, setExpandedStudent] = useState(null);
  const [studentSearch, setStudentSearch] = useState("");

  // Fetch sections on mount
  useEffect(() => {
    const fetchSections = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setError("User not authenticated");
          setLoadingSections(false);
          return;
        }
        setUserId(user.id);

        const { data: sectionsData, error: sectionsError } = await supabase
          .from("sections")
          .select("*")
          .eq("instructor_id", user.id)
          .eq("is_archived", false)
          .order("name", { ascending: true });

        if (sectionsError) throw sectionsError;
        setSections(sectionsData || []);
      } catch (err) {
        setError(err.message || "Failed to load sections");
      } finally {
        setLoadingSections(false);
      }
    };
    fetchSections();
  }, []);

  // Fetch quizzes when section changes
  useEffect(() => {
    const fetchQuizzes = async () => {
      if (!selectedSection) {
        setQuizzes([]);
        setSelectedQuiz("");
        setStudentsData([]);
        return;
      }

      setLoadingQuizzes(true);
      try {
        const { data: quizzesData } = await supabase
          .from("quizzes")
          .select("id, title")
          .eq("section_id", selectedSection)
          .order("title", { ascending: true });

        setQuizzes(quizzesData || []);
      } catch (err) {
        setError(err.message || "Failed to load quizzes");
      } finally {
        setLoadingQuizzes(false);
      }
    };
    fetchQuizzes();
  }, [selectedSection]);

  // Load student profiles when quiz is selected
  useEffect(() => {
    if (selectedQuiz) {
      loadStudentProfiles();
    }
  }, [selectedQuiz]);

  const loadStudentProfiles = async () => {
    if (!selectedQuiz || !selectedSection) return;

    setLoading(true);
    try {
      // Query the student_blooms_performance view
      const { data: performanceData, error: performanceError } = await supabase
        .from("student_blooms_performance")
        .select("*")
        .eq("section_id", selectedSection);

      if (performanceError) throw performanceError;

      // Build student map from view data
      const studentMap = {};
      for (const record of performanceData || []) {
        const studentKey = record.student_email;

        if (!studentMap[studentKey]) {
          studentMap[studentKey] = {
            name: record.student_name || "Unknown Student",
            email: record.student_email || "N/A",
            bloomsPerformance: {},
          };
        }

        // Aggregate by blooms_level
        const bloomLevel = record.blooms_level || "Unknown";
        if (!studentMap[studentKey].bloomsPerformance[bloomLevel]) {
          studentMap[studentKey].bloomsPerformance[bloomLevel] = {
            scores: [],
            count: 0,
          };
        }

        // Calculate percentage for this attempt
        const score = record.score || 0;
        const percentage = score * 100; // Assuming score is 0-1 or raw score
        
        studentMap[studentKey].bloomsPerformance[bloomLevel].scores.push(percentage);
        studentMap[studentKey].bloomsPerformance[bloomLevel].count++;
      }

      // Convert to array and calculate Bloom's level performance
      const students = Object.values(studentMap)
        .map((student) => {
          const totalAttempts = Object.values(student.bloomsPerformance).reduce(
            (sum, perf) => sum + perf.count,
            0
          );

          // Calculate overall average
          const allScores = Object.values(student.bloomsPerformance).flatMap(
            (perf) => perf.scores
          );
          const averageScore =
            allScores.length > 0
              ? allScores.reduce((a, b) => a + b, 0) / allScores.length
              : 0;

          // Calculate performance by Bloom's level
          const bloomsPerformanceArray = Object.entries(student.bloomsPerformance).map(
            ([level, data]) => ({
              level,
              average:
                data.scores.length > 0
                  ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length
                  : 0,
              attempts: data.count,
            })
          );

          bloomsPerformanceArray.sort((a, b) => b.average - a.average);

          return {
            ...student,
            bloomsPerformance: undefined, // Remove intermediate object
            attemptCount: totalAttempts,
            averageScore,
            bloomsPerformanceArray,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      setStudentsData(students);
    } catch (err) {
      setError(err.message || "Failed to load student profiles");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getPerformanceColor = (average) => {
    if (average >= 75) return "text-green-600 bg-green-50";
    if (average >= 60) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };

  const getPerformanceBadge = (average) => {
    if (average >= 75) return "Strong";
    if (average >= 60) return "Satisfactory";
    return "Needs Improvement";
  };

  return (
    <div className="flex-1 overflow-auto bg-authentic-white">
      {/* Header Section */}
      <div className="bg-white shadow-lg rounded-xl overflow-hidden mb-6">
        {/* Title Section */}
        <div className="p-6 bg-brand-navy text-white flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-wider">
              Student Profiles
            </h1>
            <p className="opacity-80 text-sm">
              View student strengths and weaknesses based on Bloom's Taxonomy levels
            </p>
          </div>
          {selectedQuiz && studentsData.length > 0 && (
            <div className="bg-white/20 backdrop-blur-md p-3 px-5 rounded-xl border border-white/30 text-right">
              <div className="text-[10px] uppercase font-black opacity-80 tracking-widest mb-1">
                Total Students
              </div>
              <div className="text-2xl font-black text-yellow-300">{studentsData.length}</div>
            </div>
          )}
        </div>

        {/* Selection Controls */}
        <div className="p-6 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Section Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select Section *
              </label>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">-- Select a Section --</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name || section.section_name}
                  </option>
                ))}
              </select>
              {loadingSections && (
                <p className="text-sm text-gray-500 mt-1">Loading sections...</p>
              )}
            </div>

            {/* Quiz Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select Quiz *
              </label>
              <select
                value={selectedQuiz}
                onChange={(e) => setSelectedQuiz(e.target.value)}
                disabled={!selectedSection || loadingQuizzes}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">
                  {loadingQuizzes
                    ? "Loading quizzes..."
                    : !selectedSection
                      ? "Select a section first"
                      : "-- Select a Quiz --"}
                </option>
                {quizzes &&
                  quizzes.map((quiz) => (
                    <option key={quiz.id} value={quiz.id}>
                      {quiz.title}
                    </option>
                  ))}
              </select>
            </div>

            {/* Student Search */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Search Student
              </label>
              <input
                type="text"
                placeholder="Search by student name..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                disabled={!selectedQuiz}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
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

      {/* Results Section */}
      <div className="px-6 pb-6">
        {!selectedQuiz ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <p className="text-gray-600">Select a section and quiz to view student profiles</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand-gold"></div>
              <p className="mt-4 text-brand-navy font-semibold">Loading student profiles...</p>
            </div>
          </div>
        ) : studentsData.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <p className="text-gray-600">No quiz attempts found for this quiz</p>
          </div>
        ) : studentsData.filter((student) =>
            studentSearch === ""
              ? true
              : student.name.toLowerCase().includes(studentSearch.toLowerCase())
          ).length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <p className="text-gray-600">
              No students match the search "{studentSearch}"
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {studentsData
              .filter((student) =>
                studentSearch === ""
                  ? true
                  : student.name.toLowerCase().includes(studentSearch.toLowerCase())
              )
              .map((student) => (
              <div
                key={student.email}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:border-brand-gold transition-colors"
              >
                {/* Student Header */}
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() =>
                    setExpandedStudent(expandedStudent === student.email ? null : student.email)
                  }
                >
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800">{student.name}</h3>
                    <p className="text-sm text-gray-500">{student.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div
                        className={`text-sm font-bold px-3 py-1 rounded-full ${getPerformanceColor(
                          student.averageScore,
                        )}`}
                      >
                        {getPerformanceBadge(student.averageScore)}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {student.averageScore.toFixed(1)}%
                      </p>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${
                        expandedStudent === student.email ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 14l-7 7m0 0l-7-7m7 7V3"
                      />
                    </svg>
                  </div>
                </div>

                {/* Student Details */}
                {expandedStudent === student.email && (
                  <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-3">
                        Performance by Bloom's Taxonomy Level
                      </h4>
                      {student.bloomsPerformanceArray.length === 0 ? (
                        <p className="text-sm text-gray-500">No Bloom's levels recorded yet</p>
                      ) : (
                        <div className="space-y-2">
                          {student.bloomsPerformanceArray.map((bloom) => {
                            const isStrength = bloom.average >= 75;
                            const isWeakness = bloom.average < 60;
                            let label = "Average";
                            let badgeClass = "bg-yellow-50 border-yellow-200";

                            if (isStrength) {
                              label = "Strength";
                              badgeClass = "bg-green-50 border-green-200";
                            } else if (isWeakness) {
                              label = "Weakness";
                              badgeClass = "bg-red-50 border-red-200";
                            }

                            return (
                              <div
                                key={bloom.level}
                                className={`flex items-center justify-between border ${badgeClass} p-3 rounded`}
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-sm text-gray-700">
                                      {bloom.level}
                                    </p>
                                    <span
                                      className={`text-xs font-semibold px-2 py-1 rounded ${
                                        isStrength
                                          ? "bg-green-100 text-green-700"
                                          : isWeakness
                                            ? "bg-red-100 text-red-700"
                                            : "bg-yellow-100 text-yellow-700"
                                      }`}
                                    >
                                      {label}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-500">
                                    {bloom.attempts} question{bloom.attempts > 1 ? "s" : ""} answered
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-24 bg-gray-200 rounded-full h-2">
                                    <div
                                      className={`h-2 rounded-full ${
                                        bloom.average >= 75
                                          ? "bg-green-500"
                                          : bloom.average >= 60
                                            ? "bg-yellow-500"
                                            : "bg-red-500"
                                      }`}
                                      style={{
                                        width: `${Math.min(bloom.average, 100)}%`,
                                      }}
                                    ></div>
                                  </div>
                                  <span className="font-semibold text-sm text-gray-700 w-12 text-right">
                                    {bloom.average.toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Summary */}
                    <div className="bg-blue-50 border border-blue-200 rounded p-3">
                      <p className="text-xs text-gray-700">
                        <span className="font-semibold">Overall Average:</span>{" "}
                        {student.averageScore.toFixed(1)}%
                      </p>
                      {student.bloomsPerformanceArray.length > 0 && (
                        <>
                          <p className="text-xs text-gray-700 mt-2">
                            <span className="font-semibold">Strengths:</span>{" "}
                            {student.bloomsPerformanceArray
                              .filter((b) => b.average >= 75)
                              .map((b) => b.level)
                              .join(", ") || "None yet"}
                          </p>
                          <p className="text-xs text-gray-700 mt-1">
                            <span className="font-semibold">Weaknesses:</span>{" "}
                            {student.bloomsPerformanceArray
                              .filter((b) => b.average < 60)
                              .map((b) => b.level)
                              .join(", ") || "None"}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
