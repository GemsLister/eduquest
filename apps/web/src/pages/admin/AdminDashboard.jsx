import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient.js";
import { useAdminInstructors } from "../../hooks/adminHook/useAdminInstructors.jsx";

export const AdminDashboard = () => {
  const { instructors, loading } = useAdminInstructors();
  const [adminName, setAdminName] = useState("");
  const [pendingReviews, setPendingReviews] = useState(0);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [publishedQuizRows, setPublishedQuizRows] = useState([]);
  const [publishedLoading, setPublishedLoading] = useState(true);

  useEffect(() => {
    const getAdmin = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const name =
          user.user_metadata?.full_name || user.email?.split("@")[0] || "Admin";
        setAdminName(name);
      }
    };
    getAdmin();
    loadPendingReviews();
    loadPublishedQuizOverview();
  }, []);

  const loadPendingReviews = async () => {
    try {
      const { count, error } = await supabase
        .from("quiz_analysis_submissions")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      if (!error) {
        setPendingReviews(count || 0);
      }
    } catch (err) {
      console.error("Error loading pending reviews:", err);
    } finally {
      setReviewsLoading(false);
    }
  };

  const loadPublishedQuizOverview = async () => {
    setPublishedLoading(true);
    try {
      const { data: publishedQuizzes, error: quizError } = await supabase
        .from("quizzes")
        .select("id, title, description, instructor_id, is_open, created_at")
        .eq("is_published", true)
        .eq("is_archived", false)
        .order("created_at", { ascending: false });

      if (quizError) throw quizError;

      const quizzes = publishedQuizzes || [];
      if (quizzes.length === 0) {
        setPublishedQuizRows([]);
        return;
      }

      const quizIds = quizzes.map((q) => q.id);
      const instructorIds = [...new Set(quizzes.map((q) => q.instructor_id))];

      // Query all available fields to avoid referencing optional columns directly.
      const attemptsRawRes = await supabase
        .from("quiz_attempts")
        .select("*")
        .in("quiz_id", quizIds);

      const attemptsRes = {
        data: (attemptsRawRes.data || []).map((a) => ({
          id: a.id,
          quiz_id: a.quiz_id,
          status: a.status,
          score: a.score,
          section_id: a.section_id ?? null,
        })),
        error: attemptsRawRes.error,
      };

      const [profilesRes, quizSectionsRes, sectionsRes, analysisRes] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id, first_name, last_name, username, email")
            .in("id", instructorIds),
          supabase
            .from("quiz_sections")
            .select("quiz_id, section_id")
            .in("quiz_id", quizIds),
          supabase.from("sections").select("*"),
          supabase
            .from("item_analysis")
            .select("quiz_id, difficulty_status, discrimination_status")
            .in("quiz_id", quizIds),
        ]);

      if (profilesRes.error) throw profilesRes.error;
      if (attemptsRes.error) throw attemptsRes.error;
      if (quizSectionsRes.error) throw quizSectionsRes.error;
      if (sectionsRes.error) throw sectionsRes.error;
      if (analysisRes.error) throw analysisRes.error;

      const profileMap = new Map(
        (profilesRes.data || []).map((p) => {
          const fullName = `${p.first_name || ""} ${p.last_name || ""}`.trim();
          const label =
            fullName || p.username || p.email || "Unknown Instructor";
          return [p.id, label];
        }),
      );

      const sectionNameMap = new Map(
        (sectionsRes.data || []).map((s) => [
          s.id,
          s.section_name || s.name || s.description || "Unnamed Section",
        ]),
      );

      const attemptsByQuiz = new Map();
      (attemptsRes.data || []).forEach((attempt) => {
        const list = attemptsByQuiz.get(attempt.quiz_id) || [];
        list.push(attempt);
        attemptsByQuiz.set(attempt.quiz_id, list);
      });

      const sectionMapByQuiz = new Map();
      (quizSectionsRes.data || []).forEach((row) => {
        const set = sectionMapByQuiz.get(row.quiz_id) || new Set();
        set.add(row.section_id);
        sectionMapByQuiz.set(row.quiz_id, set);
      });

      const itemAnalysisByQuiz = new Map();
      (analysisRes.data || []).forEach((row) => {
        const list = itemAnalysisByQuiz.get(row.quiz_id) || [];
        list.push(row);
        itemAnalysisByQuiz.set(row.quiz_id, list);
      });

      const rows = quizzes.map((quiz) => {
        const attempts = attemptsByQuiz.get(quiz.id) || [];
        const completedAttempts = attempts.filter(
          (a) => a.status === "completed",
        );

        const sectionIds = Array.from(sectionMapByQuiz.get(quiz.id) || []);
        const perSectionResults = sectionIds.map((sectionId) => {
          const sectionAttempts = attempts.filter(
            (a) => a.section_id === sectionId,
          );
          const completed = sectionAttempts.filter(
            (a) => a.status === "completed",
          );
          const avgScore =
            completed.length > 0
              ? Math.round(
                  completed.reduce((sum, a) => sum + (a.score || 0), 0) /
                    completed.length,
                )
              : 0;

          return {
            sectionId,
            sectionName: sectionNameMap.get(sectionId) || "Unnamed Section",
            attempts: sectionAttempts.length,
            completed: completed.length,
            averageScore: avgScore,
          };
        });

        const itemAnalysis = itemAnalysisByQuiz.get(quiz.id) || [];
        const easyCount = itemAnalysis.filter(
          (i) => (i.difficulty_status || "").toLowerCase() === "easy",
        ).length;
        const moderateCount = itemAnalysis.filter(
          (i) => (i.difficulty_status || "").toLowerCase() === "moderate",
        ).length;
        const difficultCount = itemAnalysis.filter(
          (i) => (i.difficulty_status || "").toLowerCase() === "difficult",
        ).length;

        return {
          ...quiz,
          instructorName:
            profileMap.get(quiz.instructor_id) || "Unknown Instructor",
          totalAttempts: attempts.length,
          completedAttempts: completedAttempts.length,
          averageScore:
            completedAttempts.length > 0
              ? Math.round(
                  completedAttempts.reduce(
                    (sum, a) => sum + (a.score || 0),
                    0,
                  ) / completedAttempts.length,
                )
              : 0,
          sectionCount: sectionIds.length,
          perSectionResults,
          analysisCount: itemAnalysis.length,
          easyCount,
          moderateCount,
          difficultCount,
        };
      });

      setPublishedQuizRows(rows);
    } catch (err) {
      console.error("Error loading published quiz overview:", err);
      setPublishedQuizRows([]);
    } finally {
      setPublishedLoading(false);
    }
  };

  return (
    <>
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-hornblende-green to-sea-green px-6 py-8">
        <p className="text-casual-green text-sm font-semibold uppercase tracking-widest mb-1">
          Admin
        </p>
        <h1 className="text-2xl md:text-3xl font-black text-white">
          Welcome back, {adminName}
        </h1>
        <p className="text-white/60 text-sm mt-1">
          Manage instructor accounts and system settings here.
        </p>
      </div>

      {/* Stats */}
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex items-center gap-4">
            <div className="text-3xl">👥</div>
            <div>
              <p className="text-sm text-gray-500 font-medium">
                Total Instructors
              </p>
              <p className="text-3xl font-black text-hornblende-green">
                {loading ? "—" : instructors.length}
              </p>
            </div>
          </div>

          <a
            href="/admin-dashboard/quiz-reviews"
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex items-center gap-4 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="text-3xl">🧠</div>
            <div>
              <p className="text-sm text-gray-500 font-medium">
                Pending Quiz Reviews
              </p>
              <p className="text-3xl font-black text-indigo-600">
                {reviewsLoading ? "—" : pendingReviews}
              </p>
            </div>
            {pendingReviews > 0 && (
              <div className="ml-auto">
                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-full">
                  Action Needed
                </span>
              </div>
            )}
          </a>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex items-center gap-4">
            <div className="text-3xl">📅</div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Today</p>
              <p className="text-base font-bold text-gray-700">
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3">
            Published Quiz Results and Item Analysis
          </h2>

          {publishedLoading ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center text-gray-500">
              Loading published quiz overview...
            </div>
          ) : publishedQuizRows.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center text-gray-500">
              No published quizzes found.
            </div>
          ) : (
            <div className="space-y-4">
              {publishedQuizRows.map((quiz) => (
                <div
                  key={quiz.id}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm p-6"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">
                        {quiz.title}
                      </h3>
                      <p className="text-sm text-gray-500">
                        Instructor: {quiz.instructorName}
                      </p>
                    </div>
                    <div className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-semibold w-fit">
                      {quiz.is_open === false ? "Closed" : "Open"}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4 text-sm">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-gray-500">Total Attempts</p>
                      <p className="text-lg font-bold text-gray-800">
                        {quiz.totalAttempts}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-gray-500">Completed</p>
                      <p className="text-lg font-bold text-green-600">
                        {quiz.completedAttempts}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-gray-500">Average Score</p>
                      <p className="text-lg font-bold text-indigo-600">
                        {quiz.averageScore}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-gray-500">Assigned Sections</p>
                      <p className="text-lg font-bold text-hornblende-green">
                        {quiz.sectionCount}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="border border-gray-200 rounded-lg p-3">
                      <p className="text-sm font-semibold text-gray-700 mb-2">
                        Results by Section
                      </p>
                      {quiz.perSectionResults.length === 0 ? (
                        <p className="text-xs text-gray-500">
                          No assigned sections.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {quiz.perSectionResults.map((row) => (
                            <div
                              key={row.sectionId}
                              className="text-xs bg-gray-50 rounded-md px-3 py-2"
                            >
                              <p className="font-semibold text-gray-700">
                                {row.sectionName}
                              </p>
                              <p className="text-gray-500">
                                Attempts: {row.attempts} | Completed:{" "}
                                {row.completed} | Avg Score: {row.averageScore}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="border border-gray-200 rounded-lg p-3">
                      <p className="text-sm font-semibold text-gray-700 mb-2">
                        Item Analysis Summary
                      </p>
                      {quiz.analysisCount === 0 ? (
                        <p className="text-xs text-gray-500">
                          No item analysis saved for this quiz yet.
                        </p>
                      ) : (
                        <div className="space-y-1 text-xs text-gray-600">
                          <p>
                            Total Analyzed Items:{" "}
                            <span className="font-semibold text-gray-800">
                              {quiz.analysisCount}
                            </span>
                          </p>
                          <p>
                            Easy:{" "}
                            <span className="font-semibold text-green-600">
                              {quiz.easyCount}
                            </span>
                          </p>
                          <p>
                            Moderate:{" "}
                            <span className="font-semibold text-amber-600">
                              {quiz.moderateCount}
                            </span>
                          </p>
                          <p>
                            Difficult:{" "}
                            <span className="font-semibold text-red-600">
                              {quiz.difficultCount}
                            </span>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
