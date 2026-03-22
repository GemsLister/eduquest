import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient.js";

const BLOOM_LEVELS = [
  "Remembering",
  "Understanding",
  "Applying",
  "Analyzing",
  "Evaluating",
  "Creating",
];

const BLOOM_COLORS = {
  Remembering: "bg-blue-100 border-blue-300",
  Understanding: "bg-cyan-100 border-cyan-300",
  Applying: "bg-green-100 border-green-300",
  Analyzing: "bg-yellow-100 border-yellow-300",
  Evaluating: "bg-orange-100 border-orange-300",
  Creating: "bg-purple-100 border-purple-300",
};

export const AllStudentsBloomsAnalysis = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [students, setStudents] = useState([]);
  const [studentStats, setStudentStats] = useState({});
  const [classStats, setClassStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch all instructor's students and analyze their performance
  useEffect(() => {
    const fetchData = async () => {
      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        if (authUser) setUser(authUser);

        if (authUser) {
          // Get all sections for this instructor
          const { data: sectionsData } = await supabase
            .from("sections")
            .select("id")
            .eq("instructor_id", authUser.id);

          console.log("Sections:", sectionsData);

          if (!sectionsData || sectionsData.length === 0) {
            console.log("No sections found");
            setLoading(false);
            return;
          }

          const sectionIds = sectionsData.map((s) => s.id);

          // Get all quiz attempts for students in these sections
          const { data: attemptsData } = await supabase
            .from("quiz_attempts")
            .select(
              `
              id,
              student_id,
              quiz_id,
              score,
              total_points
            `
            )
            .in("section_id", sectionIds);

          console.log("Quiz attempts:", attemptsData);

          if (!attemptsData || attemptsData.length === 0) {
            console.log("No quiz attempts found");
            setLoading(false);
            return;
          }

          // Get unique student IDs
          const studentIds = [
            ...new Set(attemptsData.map((a) => a.student_id)),
          ];

          console.log("Student IDs:", studentIds);

          // Get student profiles
          const { data: studentProfilesData } = await supabase
            .from("student_profile")
            .select("id, name, email, student_id, avatar_url")
            .in("id", studentIds);

          console.log("Student profiles:", studentProfilesData);

          if (!studentProfilesData || studentProfilesData.length === 0) {
            setLoading(false);
            return;
          }

          // Get all quiz responses for the attempts
          const attemptIds = attemptsData.map((a) => a.id);
          const { data: responsesData } = await supabase
            .from("quiz_responses")
            .select("id, attempt_id, question_id, is_correct")
            .in("attempt_id", attemptIds);

          // Try to get questions with blooms_level if it exists
          let questionsData = [];
          if (responsesData && responsesData.length > 0) {
            const questionIds = [
              ...new Set(responsesData.map((r) => r.question_id)),
            ];
            const { data: qData } = await supabase
              .from("questions")
              .select("id, blooms_level")
              .in("id", questionIds);
            questionsData = qData || [];
          }

          // Create a map of question blooms levels
          const questionsMap = {};
          questionsData.forEach((q) => {
            if (q.blooms_level) {
              questionsMap[q.id] = q.blooms_level;
            }
          });

          setStudents(studentProfilesData || []);

          // Create a map of attempts for quick lookup
          const attemptsMap = {};
          attemptsData.forEach((attempt) => {
            attemptsMap[attempt.id] = attempt;
          });

          // Calculate stats for each student
          const stats = {};
          const classBloomsData = {};
          let totalCorrect = 0;
          let totalAttempted = 0;

          BLOOM_LEVELS.forEach((level) => {
            classBloomsData[level] = {
              correct: 0,
              total: 0,
              accuracy: 0,
            };
          });

          studentProfilesData?.forEach((student) => {
            const studentAttempts = attemptsData.filter(
              (a) => a.student_id === student.id,
            );

            const bloomsAnalysis = {};
            BLOOM_LEVELS.forEach((level) => {
              bloomsAnalysis[level] = { correct: 0, total: 0 };
            });

            // Get responses for this student's attempts
            const studentResponses = responsesData?.filter((resp) =>
              studentAttempts.some((a) => a.id === resp.attempt_id),
            ) || [];

            studentResponses.forEach((response) => {
              const bloomsLevel = questionsMap[response.question_id];
              if (bloomsLevel && bloomsAnalysis[bloomsLevel]) {
                bloomsAnalysis[bloomsLevel].total += 1;
                if (response.is_correct) {
                  bloomsAnalysis[bloomsLevel].correct += 1;
                }
              }
            });

            // Calculate accuracies
            let studentsTotalCorrect = 0;
            let studentsTotalAttempted = 0;
            Object.keys(bloomsAnalysis).forEach((level) => {
              const accuracy = bloomsAnalysis[level].total
                ? Math.round(
                    (bloomsAnalysis[level].correct /
                      bloomsAnalysis[level].total) *
                      100,
                  )
                : 0;
              bloomsAnalysis[level].accuracy = accuracy;
              studentsTotalCorrect += bloomsAnalysis[level].correct;
              studentsTotalAttempted += bloomsAnalysis[level].total;

              classBloomsData[level].correct +=
                bloomsAnalysis[level].correct;
              classBloomsData[level].total += bloomsAnalysis[level].total;
            });

            totalCorrect += studentsTotalCorrect;
            totalAttempted += studentsTotalAttempted;

            // Identify strengths (≥75%) and weaknesses (<60%)
            const strengths = [];
            const weaknesses = [];

            Object.entries(bloomsAnalysis).forEach(([level, data]) => {
              if (data.total > 0) {
                if (data.accuracy >= 75) {
                  strengths.push(level);
                } else if (data.accuracy < 60) {
                  weaknesses.push(level);
                }
              }
            });

            // Calculate LOTS vs HOTS
            const lotsData = BLOOM_LEVELS.slice(0, 3);
            const hotsData = BLOOM_LEVELS.slice(3);

            let lotsCorrect = 0,
              lotsTotal = 0;
            let hotsCorrect = 0,
              hotsTotal = 0;

            lotsData.forEach((level) => {
              lotsCorrect += bloomsAnalysis[level].correct;
              lotsTotal += bloomsAnalysis[level].total;
            });

            hotsData.forEach((level) => {
              hotsCorrect += bloomsAnalysis[level].correct;
              hotsTotal += bloomsAnalysis[level].total;
            });

            const lotsAccuracy = lotsTotal
              ? Math.round((lotsCorrect / lotsTotal) * 100)
              : 0;
            const hotsAccuracy = hotsTotal
              ? Math.round((hotsCorrect / hotsTotal) * 100)
              : 0;

            stats[student.id] = {
              name: student.name,
              email: student.email,
              student_id: student.student_id,
              avatar_url: student.avatar_url,
              bloomsAnalysis,
              strengths,
              weaknesses,
              lotsAccuracy,
              hotsAccuracy,
              lotsTotal,
              hotsTotal,
              overallAccuracy: studentsTotalAttempted
                ? Math.round((studentsTotalCorrect / studentsTotalAttempted) * 100)
                : 0,
            };
          });

          // Calculate class accuracies
          Object.keys(classBloomsData).forEach((level) => {
            classBloomsData[level].accuracy = classBloomsData[level].total
              ? Math.round(
                  (classBloomsData[level].correct /
                    classBloomsData[level].total) *
                    100,
                )
              : 0;
          });

          const classLotsCorrect = classBloomsData.Remembering.correct +
            classBloomsData.Understanding.correct +
            classBloomsData.Applying.correct;
          const classLotsTotal = classBloomsData.Remembering.total +
            classBloomsData.Understanding.total +
            classBloomsData.Applying.total;
          const classHotsCorrect = classBloomsData.Analyzing.correct +
            classBloomsData.Evaluating.correct +
            classBloomsData.Creating.correct;
          const classHotsTotal = classBloomsData.Analyzing.total +
            classBloomsData.Evaluating.total +
            classBloomsData.Creating.total;

          setClassStats({
            bloomsData: classBloomsData,
            lotsAccuracy: classLotsTotal
              ? Math.round((classLotsCorrect / classLotsTotal) * 100)
              : 0,
            hotsAccuracy: classHotsTotal
              ? Math.round((classHotsCorrect / classHotsTotal) * 100)
              : 0,
            lotsTotal: classLotsTotal,
            hotsTotal: classHotsTotal,
            overallAccuracy: totalAttempted
              ? Math.round((totalCorrect / totalAttempted) * 100)
              : 0,
            studentCount: studentProfilesData?.length || 0,
          });

          setStudentStats(stats);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredStudents = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    return students.filter(
      (student) =>
        student.name?.toLowerCase().includes(searchLower) ||
        student.email?.toLowerCase().includes(searchLower) ||
        student.student_id?.toLowerCase().includes(searchLower),
    );
  }, [students, searchTerm]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-casual-green"></div>
          <p className="mt-4 text-hornblende-green font-semibold">
            Analyzing student performance...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-authentic-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-hornblende-green to-sea-green px-6 py-8">
        <button
          onClick={() => navigate("/instructor-dashboard")}
          className="text-white/70 hover:text-white mb-4 flex items-center gap-2 text-sm font-medium"
        >
          ← Back
        </button>
        <h1 className="text-3xl font-black text-white mb-2">
          Class Bloom's Analysis
        </h1>
        <p className="text-white/70">
          Overview of all students' strengths and weaknesses across cognitive
          levels
        </p>
      </div>

      <div className="p-6">
        {!classStats || classStats.studentCount === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">
              No student data available yet
            </p>
          </div>
        ) : (
          <>
            {/* Class Performance Summary */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-hornblende-green mb-6">
                Class Overview
              </h2>

              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <div className="text-sm text-gray-600 font-semibold mb-1">
                    Total Students
                  </div>
                  <div className="text-4xl font-black text-hornblende-green">
                    {classStats.studentCount}
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <div className="text-sm text-gray-600 font-semibold mb-1">
                    Overall Accuracy
                  </div>
                  <div className="text-4xl font-black text-casual-green">
                    {classStats.overallAccuracy}%
                  </div>
                </div>

                <div className="bg-emerald-50 border-2 border-emerald-300 rounded-lg p-6">
                  <div className="text-sm text-emerald-700 font-semibold mb-1">
                    LOTS Avg
                  </div>
                  <div className="text-4xl font-black text-emerald-600">
                    {classStats.lotsAccuracy}%
                  </div>
                </div>

                <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-6">
                  <div className="text-sm text-amber-700 font-semibold mb-1">
                    HOTS Avg
                  </div>
                  <div className="text-4xl font-black text-amber-600">
                    {classStats.hotsAccuracy}%
                  </div>
                </div>
              </div>

              {/* Bloom's Level Performance Bars */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">
                  Performance by Bloom's Level
                </h3>
                <div className="space-y-3">
                  {BLOOM_LEVELS.map((level) => {
                    const data = classStats.bloomsData[level];
                    const percentage = data.accuracy;
                    return (
                      <div key={level}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-semibold text-gray-700">
                            {level}
                          </span>
                          <span className="text-sm font-bold text-gray-600">
                            {data.correct}/{data.total} ({percentage}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div
                            className={`h-2.5 rounded-full transition-all ${
                              percentage >= 75
                                ? "bg-emerald-500"
                                : percentage >= 60
                                  ? "bg-yellow-500"
                                  : "bg-red-500"
                            }`}
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Students Analysis */}
            <div>
              <h2 className="text-2xl font-bold text-hornblende-green mb-4">
                Student Performance
              </h2>

              {/* Search */}
              <div className="mb-6">
                <input
                  type="text"
                  placeholder="Search by name, email, or student ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full md:w-80 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-casual-green"
                />
              </div>

              {filteredStudents.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No students found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredStudents.map((student) => {
                    const stats = studentStats[student.id];
                    if (!stats) return null;

                    return (
                      <button
                        key={student.id}
                        onClick={() =>
                          navigate(
                            `/instructor-dashboard/student-profile/${student.id}`,
                          )
                        }
                        className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-lg hover:border-casual-green transition-all text-left"
                      >
                        {/* Header */}
                        <div className="flex items-start gap-3 mb-4">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-casual-green to-hornblende-green flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                            {stats.name?.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-800 truncate">
                              {stats.name}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {stats.email}
                            </p>
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-2 mb-4">
                          <div className="bg-gray-50 rounded p-2">
                            <div className="text-xs text-gray-600">Overall</div>
                            <div className="text-lg font-black text-casual-green">
                              {stats.overallAccuracy}%
                            </div>
                          </div>
                          <div className="bg-emerald-50 rounded p-2 border border-emerald-200">
                            <div className="text-xs text-emerald-700 font-medium">
                              LOTS
                            </div>
                            <div className="text-lg font-black text-emerald-600">
                              {stats.lotsAccuracy}%
                            </div>
                          </div>
                          <div className="bg-amber-50 rounded p-2 border border-amber-200">
                            <div className="text-xs text-amber-700 font-medium">
                              HOTS
                            </div>
                            <div className="text-lg font-black text-amber-600">
                              {stats.hotsAccuracy}%
                            </div>
                          </div>
                        </div>

                        {/* Strengths */}
                        {stats.strengths.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs font-semibold text-gray-600 mb-1">
                              Strengths
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {stats.strengths.map((level) => (
                                <span
                                  key={level}
                                  className={`text-xs font-semibold px-2 py-1 rounded border ${BLOOM_COLORS[level]}`}
                                >
                                  {level}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Weaknesses */}
                        {stats.weaknesses.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-600 mb-1">
                              Weaknesses
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {stats.weaknesses.map((level) => (
                                <span
                                  key={level}
                                  className={`text-xs font-semibold px-2 py-1 rounded bg-red-50 border border-red-300 text-red-700`}
                                >
                                  {level}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* No data message */}
                        {stats.strengths.length === 0 &&
                          stats.weaknesses.length === 0 && (
                            <p className="text-xs text-gray-500 italic">
                              No quiz attempts yet
                            </p>
                          )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
