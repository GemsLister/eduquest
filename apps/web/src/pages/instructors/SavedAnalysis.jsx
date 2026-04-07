import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { notify } from "../../utils/notify.jsx";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../context/AuthContext";

export const SavedAnalysisPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSavedAnalyses = async () => {
      if (!user) return;
      try {

        const { data: myQuizzes } = await supabase
          .from("quizzes")
          .select("*, quiz_attempts(count)")
          .eq("instructor_id", user.id)
          .eq("is_archived", false)
          .order("created_at", { ascending: false });

        if (!myQuizzes || myQuizzes.length === 0) {
          setQuizzes([]);
          setLoading(false);
          return;
        }

        const quizIds = myQuizzes.map((q) => q.id);

        const { data: analysisData } = await supabase
          .from("item_analysis")
          .select("quiz_id")
          .in("quiz_id", quizIds);

        const quizzesWithAnalysisIds = new Set(
          analysisData?.map((a) => a.quiz_id) || []
        );

        const finalQuizzes = myQuizzes.filter((q) =>
          quizzesWithAnalysisIds.has(q.id)
        );
        setQuizzes(finalQuizzes);
      } catch (err) {
        console.error("Error fetching saved analyses:", err);
        notify.error("Failed to load saved analyses.");
      } finally {
        setLoading(false);
      }
    };
    fetchSavedAnalyses();
  }, []);

  const handleArchive = async (quizId, quizTitle) => {
    if (window.confirm(`Are you sure you want to archive "${quizTitle}"?`)) {
      try {
        const { error } = await supabase
          .from("quizzes")
          .update({ is_archived: true })
          .eq("id", quizId);
        if (error) throw error;
        setQuizzes(quizzes.filter((q) => q.id !== quizId));
        notify.success("Quiz archived successfully");
      } catch (error) {
        notify.error("Failed to archive quiz: " + error.message);
      }
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h1 className="text-3xl font-bold text-gray-800">Saved Analysis</h1>
        <p className="text-gray-500 mt-1">
          View previously saved item difficulty and discrimination analyses
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-gold"></div>
        </div>
      ) : quizzes.length === 0 ? (
        <div className="bg-white rounded-lg p-12 text-center shadow-sm border border-gray-200">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            No Saved Analyses
          </h3>
          <p className="text-gray-500">
            Run an Item Analysis on your quizzes and click "Save Analysis" to see them here.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(
            quizzes.reduce((acc, quiz) => {
              const rootId = quiz.parent_quiz_id || quiz.id;
              if (!acc[rootId]) acc[rootId] = [];
              acc[rootId].push(quiz);
              return acc;
            }, {})
          ).map(([rootId, group]) => {
            // Sort group by created_at descending (newest version first)
            group.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            
            return (
              <div key={rootId} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h2 className="text-xl font-bold text-brand-navy border-b border-gray-100 pb-3 mb-5 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-brand-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  Analysis History: {group[group.length - 1].title.replace(/ \(Revised.*\)/, '')} {group.length > 1 && <span className="text-sm font-normal text-gray-500">({group.length} versions)</span>}
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {group.map((quiz, index) => {
                    const attemptsCount = quiz.quiz_attempts?.[0]?.count || 0;
                    const isLatest = index === 0;
                    
                    return (
                      <div
                        key={quiz.id}
                        className={`bg-white rounded-xl border transition-shadow overflow-hidden flex flex-col ${isLatest ? 'border-brand-gold shadow-md' : 'border-gray-200 shadow-sm opacity-90'}`}
                      >
                        {/* Header matching original card style */}
                        <div className={`px-5 py-4 relative ${isLatest ? 'bg-gradient-to-r from-brand-navy to-brand-indigo' : 'bg-gray-100'}`}>
                          {quiz.is_published ? (
                            <span className={`absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold ${isLatest ? 'bg-white/25 text-white' : 'bg-gray-300 text-gray-700'}`}>
                              Published
                            </span>
                          ) : (
                            <span className={`absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold ${isLatest ? 'bg-yellow-700/40 text-white' : 'bg-gray-300 text-gray-700'}`}>
                              Draft
                            </span>
                          )}
                          <h3 className={`font-bold text-lg pr-20 leading-snug line-clamp-2 ${isLatest ? 'text-white' : 'text-gray-700'}`}>
                            {quiz.title}
                          </h3>
                        </div>

                        <div className="p-4 flex-1 flex flex-col gap-3">
                          <div className="flex items-center gap-3 text-sm text-gray-600">
                            <div>
                              <span className="font-semibold text-gray-800">
                                {quiz.questions_count || 0}
                              </span>{" "}
                              Questions
                            </div>
                            <div>
                              <span className="font-semibold text-gray-800">
                                {attemptsCount}
                              </span>{" "}
                              Attempts
                            </div>
                          </div>

                          <div className="flex gap-2 mt-auto pt-4 border-t border-gray-100">
                            <button
                              onClick={() =>
                                navigate(`/instructor-dashboard/quiz-results/${quiz.id}`)
                              }
                              className="flex-1 bg-brand-navy text-white py-2 rounded-lg text-sm font-semibold hover:bg-brand-indigo transition-colors"
                            >
                              Results
                            </button>
                            <button
                              onClick={() =>
                                navigate(
                                  `/instructor-dashboard/item-difficulty-analysis?quizId=${quiz.id}&sectionId=${
                                    quiz.section_id || ""
                                  }`
                                )
                              }
                              className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors"
                            >
                              View Analysis
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleArchive(quiz.id, quiz.title);
                              }}
                              className="px-3 py-2 rounded-lg text-xs font-semibold bg-red-50 text-red-500 hover:bg-red-100 border border-red-200 transition-colors flex items-center justify-center gap-1"
                              title="Archive this quiz"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-3.5 w-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
