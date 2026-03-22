import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient.js";

const BLOOM_LEVELS = [
  "Remembering",
  "Understanding",
  "Applying",
  "Analyzing",
  "Evaluating",
  "Creating",
];

const LOTS_LEVELS = ["Remembering", "Understanding", "Applying"];
const HOTS_LEVELS = ["Analyzing", "Evaluating", "Creating"];

const BLOOM_COLORS = {
  Remembering: "#ef4444",
  Understanding: "#f97316",
  Applying: "#eab308",
  Analyzing: "#84cc16",
  Evaluating: "#06b6d4",
  Creating: "#8b5cf6",
};

export const StudentProfile = () => {
  const navigate = useNavigate();
  const { studentId } = useParams();

  const [student, setStudent] = useState(null);
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState("");
  const [sectionPerformance, setSectionPerformance] = useState({});
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Fetch instructor and student info
  useEffect(() => {
    const fetchData = async () => {
      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        if (authUser) setUser(authUser);

        // Get student info
        if (studentId) {
          const { data: studentData } = await supabase
            .from("student_profile")
            .select("*")
            .eq("id", studentId)
            .single();
          setStudent(studentData);
        }

        // Get instructor's sections
        if (authUser) {
          const { data: sectionsData } = await supabase
            .from("sections")
            .select("id, name, description")
            .eq("instructor_id", authUser.id)
            .order("created_at", { ascending: false });
          setSections(sectionsData || []);
          if (sectionsData?.length > 0) {
            setSelectedSection(sectionsData[0].id);
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [studentId]);

  // Analyze student performance by Bloom's levels
  useEffect(() => {
    const analyzePerformance = async () => {
      if (!selectedSection || !studentId) return;

      try {
        // Get all quizzes in the section
        const { data: quizzes } = await supabase
          .from("quizzes")
          .select("id, title")
          .eq("section_id", selectedSection)
          .eq("is_archived", false);

        if (!quizzes || quizzes.length === 0) {
          setSectionPerformance({});
          return;
        }

        const quizIds = quizzes.map((q) => q.id);

        // Get student's attempts for these quizzes
        const { data: attempts } = await supabase
          .from("quiz_attempts")
          .select("id, quiz_id, score, total_points")
          .in("quiz_id", quizIds)
          .eq("student_id", studentId);

        if (!attempts || attempts.length === 0) {
          setSectionPerformance({});
          return;
        }

        const attemptIds = attempts.map((a) => a.id);

        // Get quiz responses and questions with bloom's data
        const { data: responses } = await supabase
          .from("quiz_responses")
          .select("id, attempt_id, question_id, is_correct, question:questions(id, text, blooms_level, blooms_thinking_order)")
          .in("attempt_id", attemptIds);

        // Analyze by Bloom's level
        const bloomsAnalysis = {
          distribution: {
            Remembering: 0,
            Understanding: 0,
            Applying: 0,
            Analyzing: 0,
            Evaluating: 0,
            Creating: 0,
          },
          performance: {
            Remembering: { correct: 0, total: 0 },
            Understanding: { correct: 0, total: 0 },
            Applying: { correct: 0, total: 0 },
            Analyzing: { correct: 0, total: 0 },
            Evaluating: { correct: 0, total: 0 },
            Creating: { correct: 0, total: 0 },
          },
          quizzes: quizzes.length,
          totalAttempts: attempts.length,
        };

        responses?.forEach((response) => {
          const bloomsLevel =
            response.question?.blooms_level || "Understanding";
          bloomsAnalysis.distribution[bloomsLevel]++;
          bloomsAnalysis.performance[bloomsLevel].total++;

          if (response.is_correct) {
            bloomsAnalysis.performance[bloomsLevel].correct++;
          }
        });

        setSectionPerformance(bloomsAnalysis);
      } catch (error) {
        console.error("Error analyzing performance:", error);
      }
    };

    analyzePerformance();
  }, [selectedSection, studentId]);

  // Calculate strengths and weaknesses
  const performanceInsights = useMemo(() => {
    if (
      !sectionPerformance.performance ||
      Object.keys(sectionPerformance.performance).length === 0
    ) {
      return { strengths: [], weaknesses: [] };
    }

    const levels = Object.entries(sectionPerformance.performance)
      .map(([level, data]) => ({
        level,
        accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
        total: data.total,
        correct: data.correct,
      }))
      .filter((item) => item.total > 0)
      .sort((a, b) => b.accuracy - a.accuracy);

    const strengths = levels.filter((item) => item.accuracy >= 75);
    const weaknesses = levels.filter((item) => item.accuracy < 60);

    return { strengths, weaknesses, levels };
  }, [sectionPerformance]);

  // Calculate LOTS vs HOTS
  const lotsHotsAnalysis = useMemo(() => {
    if (!sectionPerformance.performance) return null;

    let lotsCorrect = 0,
      lotsTotal = 0;
    let hotsCorrect = 0,
      hotsTotal = 0;

    LOTS_LEVELS.forEach((level) => {
      const data = sectionPerformance.performance[level];
      lotsCorrect += data.correct;
      lotsTotal += data.total;
    });

    HOTS_LEVELS.forEach((level) => {
      const data = sectionPerformance.performance[level];
      hotsCorrect += data.correct;
      hotsTotal += data.total;
    });

    return {
      lots: {
        accuracy: lotsTotal > 0 ? Math.round((lotsCorrect / lotsTotal) * 100) : 0,
        correct: lotsCorrect,
        total: lotsTotal,
      },
      hots: {
        accuracy: hotsTotal > 0 ? Math.round((hotsCorrect / hotsTotal) * 100) : 0,
        correct: hotsCorrect,
        total: hotsTotal,
      },
    };
  }, [sectionPerformance]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-casual-green"></div>
          <p className="mt-4 text-hornblende-green font-semibold">
            Loading student profile...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-authentic-white p-6">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="text-casual-green font-semibold mb-4 hover:underline flex items-center gap-2"
      >
        ← Back
      </button>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-casual-green to-hornblende-green flex items-center justify-center text-white text-2xl font-bold">
            {student?.student_name?.charAt(0)?.toUpperCase() || "S"}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-hornblende-green">
              {student?.student_name || "Student Profile"}
            </h1>
            <p className="text-gray-600">
              Student ID: {student?.student_id || studentId}
            </p>
            <p className="text-gray-600">{student?.student_email}</p>
          </div>
        </div>
      </div>

      {/* Section Selection */}
      <div className="mb-6 max-w-xs">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Select Section
        </label>
        <select
          value={selectedSection}
          onChange={(e) => setSelectedSection(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-casual-green focus:ring-2 focus:ring-casual-green focus:ring-opacity-20"
        >
          {sections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.name}
            </option>
          ))}
        </select>
      </div>

      {/* Main Content */}
      {selectedSection && sectionPerformance.performance ? (
        <div className="space-y-8">
          {/* LOTS vs HOTS Overview */}
          {lotsHotsAnalysis && (
            <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-200">
              <h2 className="text-xl font-bold text-hornblende-green mb-6">
                Lower vs Higher Order Thinking Skills
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* LOTS */}
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-6 border-2 border-emerald-300">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-emerald-900">
                      LOTS (Remember, Understand, Apply)
                    </h3>
                    <span className="text-3xl font-black text-emerald-600">
                      {lotsHotsAnalysis.lots.accuracy}%
                    </span>
                  </div>
                  <p className="text-sm text-emerald-700 mb-4">
                    Accuracy: {lotsHotsAnalysis.lots.correct} /{" "}
                    {lotsHotsAnalysis.lots.total} correct
                  </p>
                  <div className="w-full bg-emerald-200 rounded-full h-3">
                    <div
                      className="bg-emerald-600 h-3 rounded-full transition-all duration-500"
                      style={{
                        width: `${lotsHotsAnalysis.lots.accuracy}%`,
                      }}
                    />
                  </div>
                </div>

                {/* HOTS */}
                <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-6 border-2 border-amber-300">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-amber-900">
                      HOTS (Analyze, Evaluate, Create)
                    </h3>
                    <span className="text-3xl font-black text-amber-600">
                      {lotsHotsAnalysis.hots.accuracy}%
                    </span>
                  </div>
                  <p className="text-sm text-amber-700 mb-4">
                    Accuracy: {lotsHotsAnalysis.hots.correct} /{" "}
                    {lotsHotsAnalysis.hots.total} correct
                  </p>
                  <div className="w-full bg-amber-200 rounded-full h-3">
                    <div
                      className="bg-amber-600 h-3 rounded-full transition-all duration-500"
                      style={{
                        width: `${lotsHotsAnalysis.hots.accuracy}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bloom's Level Breakdown */}
          <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-200">
            <h2 className="text-xl font-bold text-hornblende-green mb-6">
              Performance by Bloom's Level
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {performanceInsights.levels?.map((item) => (
                <div
                  key={item.level}
                  className="p-4 rounded-lg border-2 transition-all hover:shadow-md"
                  style={{
                    borderColor: BLOOM_COLORS[item.level],
                    backgroundColor:
                      BLOOM_COLORS[item.level] + "10",
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-800">
                      {item.level}
                    </h3>
                    <span
                      className="text-xl font-black"
                      style={{ color: BLOOM_COLORS[item.level] }}
                    >
                      {item.accuracy}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mb-3">
                    {item.correct} / {item.total} correct
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${item.accuracy}%`,
                        backgroundColor: BLOOM_COLORS[item.level],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Strengths */}
          {performanceInsights.strengths.length > 0 && (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 shadow-lg rounded-xl p-6 border-2 border-green-300">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">✅</span>
                <h2 className="text-xl font-bold text-green-900">Strengths</h2>
              </div>
              <p className="text-sm text-green-700 mb-4">
                The student demonstrates strong understanding in these areas (≥75% accuracy):
              </p>
              <ul className="space-y-2">
                {performanceInsights.strengths.map((item) => (
                  <li key={item.level} className="flex items-center gap-3">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: BLOOM_COLORS[item.level] }}
                    />
                    <span className="text-green-800">
                      <strong>{item.level}</strong> - {item.accuracy}% accuracy
                      ({item.correct}/{item.total})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Weaknesses */}
          {performanceInsights.weaknesses.length > 0 && (
            <div className="bg-gradient-to-br from-red-50 to-orange-50 shadow-lg rounded-xl p-6 border-2 border-red-300">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">⚠️</span>
                <h2 className="text-xl font-bold text-red-900">
                  Areas for Improvement
                </h2>
              </div>
              <p className="text-sm text-red-700 mb-4">
                The student needs support in these areas (&lt;60% accuracy):
              </p>
              <ul className="space-y-2">
                {performanceInsights.weaknesses.map((item) => (
                  <li key={item.level} className="flex items-center gap-3">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: BLOOM_COLORS[item.level] }}
                    />
                    <span className="text-red-800">
                      <strong>{item.level}</strong> - {item.accuracy}% accuracy
                      ({item.correct}/{item.total})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Summary Stats */}
          {sectionPerformance && (
            <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-200">
              <h2 className="text-xl font-bold text-hornblende-green mb-4">
                Summary
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-3xl font-black text-hornblende-green">
                    {sectionPerformance.quizzes}
                  </p>
                  <p className="text-sm text-gray-600">Quizzes Available</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-black text-casual-green">
                    {sectionPerformance.totalAttempts}
                  </p>
                  <p className="text-sm text-gray-600">Attempts Taken</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-black text-emerald-600">
                    {sectionPerformance.totalAttempts > 0
                      ? Math.round(
                          Object.values(sectionPerformance.performance).reduce(
                            (sum, p) => sum + (p.correct / (p.total || 1)) * 100,
                            0
                          ) / 6
                        )
                      : 0}
                    %
                  </p>
                  <p className="text-sm text-gray-600">Average Accuracy</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-black text-blue-600">
                    {Object.values(sectionPerformance.distribution).reduce(
                      (a, b) => a + b,
                      0
                    )}
                  </p>
                  <p className="text-sm text-gray-600">Questions Attempted</p>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 text-lg">
            No performance data available for this section yet.
          </p>
        </div>
      )}
    </div>
  );
};
