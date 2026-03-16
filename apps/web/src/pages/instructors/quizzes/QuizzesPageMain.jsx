import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as QuizHooks from "../../../hooks/quizHook/quizHooks.js";
import { CreateQuizFormButton } from "../../../components/ui/buttons/CreateQuizFormButton.jsx";
import { supabase } from "../../../supabaseClient.js";

export const QuizzesPageMain = () => {
  const [user, setUser] = useState(null);
  const [filter, setFilter] = useState("all_active");
  const navigate = useNavigate();

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (authUser) setUser(authUser);
    });
  }, []);

  const {
    quizFormData,
    showQuizForm,
    handleCreateQuiz,
    setQuizFormData,
    isSubmitting,
  } = QuizHooks.useCreateQuiz({ user: user || {} });

  const { quizzes, loading, handleRestoreQuiz, handleArchiveQuiz } =
    QuizHooks.useFetchInstructorQuizzes();

  const filteredQuizzes =
    quizzes?.filter((quiz) => {
      if (filter === "archived") return quiz.is_archived;

      // Ignore archived quizzes in other views
      if (quiz.is_archived) return false;

      if (filter === "all_active") return true;
      if (filter === "drafts") return !quiz.is_published;
      if (filter === "active") return quiz.is_published && quiz.is_open;
      if (filter === "closed") return quiz.is_published && !quiz.is_open;

      return true;
    }) || [];

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="mb-4 md:mb-0">
          <h1 className="text-3xl font-bold text-gray-800">Quiz Management</h1>
          <p className="text-gray-500 mt-1">
            Create, manage, and restore your quizzes
          </p>
        </div>
        <CreateQuizFormButton
          onCreateQuiz={handleCreateQuiz}
          setShowQuizForm={setQuizFormData}
          showQuizForm={showQuizForm}
          quizFormData={quizFormData}
          setQuizFormData={setQuizFormData}
          isSubmitting={isSubmitting}
        />
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setFilter("all_active")}
          className={`px-4 py-2 rounded-full font-medium transition-colors whitespace-nowrap ${filter === "all_active" ? "bg-casual-green text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"}`}
        >
          All Active
        </button>
        <button
          onClick={() => setFilter("active")}
          className={`px-4 py-2 rounded-full font-medium transition-colors whitespace-nowrap ${filter === "active" ? "bg-blue-600 text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"}`}
        >
          Open for Attempts
        </button>
        <button
          onClick={() => setFilter("closed")}
          className={`px-4 py-2 rounded-full font-medium transition-colors whitespace-nowrap ${filter === "closed" ? "bg-red-500 text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"}`}
        >
          Closed
        </button>
        <button
          onClick={() => setFilter("drafts")}
          className={`px-4 py-2 rounded-full font-medium transition-colors whitespace-nowrap ${filter === "drafts" ? "bg-yellow-500 text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"}`}
        >
          Drafts
        </button>
        <button
          onClick={() => setFilter("archived")}
          className={`px-4 py-2 rounded-full font-medium transition-colors whitespace-nowrap ${filter === "archived" ? "bg-gray-800 text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"}`}
        >
          Archived
        </button>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          {filter === "all_active"
            ? "All Active Quizzes"
            : filter === "active"
              ? "Open Quizzes"
              : filter === "drafts"
                ? "Draft Quizzes"
                : filter === "closed"
                  ? "Closed Quizzes"
                  : "Archived Quizzes"}
        </h2>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-casual-green"></div>
          </div>
        ) : filteredQuizzes.length === 0 ? (
          <div className="bg-white rounded-lg p-12 text-center shadow-sm border border-gray-200">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              No Quizzes Found
            </h3>
            <p className="text-gray-500">
              No quizzes match the current filter.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredQuizzes.map((quiz) => (
              <div
                key={quiz.id}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden group flex flex-col"
              >
                <div
                  className={`h-32 group-hover:opacity-90 transition-opacity flex items-center justify-center relative 
                  ${
                    quiz.is_archived
                      ? "bg-gradient-to-r from-gray-400 to-gray-500"
                      : !quiz.is_published
                        ? "bg-gradient-to-r from-yellow-400 to-yellow-500"
                        : !quiz.is_open
                          ? "bg-gradient-to-r from-red-400 to-red-500"
                          : "bg-gradient-to-r from-blue-400 to-blue-500"
                  }`}
                >
                  <div
                    className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-semibold text-white 
                    ${
                      quiz.is_archived
                        ? "bg-gray-600"
                        : !quiz.is_published
                          ? "bg-yellow-600"
                          : !quiz.is_open
                            ? "bg-red-600"
                            : "bg-blue-600"
                    }`}
                  >
                    {quiz.is_archived
                      ? "Archived"
                      : !quiz.is_published
                        ? "Draft"
                        : !quiz.is_open
                          ? "Closed"
                          : "Open"}
                  </div>
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="font-bold text-lg text-gray-800 mb-2 truncate">
                    {quiz.title}
                  </h3>
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                    {quiz.description || "No description"}
                  </p>
                  <div className="flex justify-between text-sm text-gray-500 mb-4 mt-auto">
                    <span>{quiz.questions_count || 0} Questions</span>
                    <span>{quiz.attempts || 0} Attempts</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        navigate(
                          `/instructor-dashboard/instructor-quiz/${quiz.id}`,
                        )
                      }
                      className="flex-1 bg-gray-200 text-gray-700 py-2 rounded text-sm font-semibold hover:bg-gray-300 transition-colors"
                    >
                      View
                    </button>
                    {quiz.is_archived ? (
                      <button
                        onClick={() => handleRestoreQuiz(quiz.id)}
                        className="flex-1 bg-casual-green text-white py-2 rounded text-sm font-semibold hover:bg-hornblende-green transition-colors"
                      >
                        Restore
                      </button>
                    ) : (
                      <button
                        onClick={() => handleArchiveQuiz(quiz.id)}
                        className="flex-1 bg-red-50 text-red-600 py-2 rounded text-sm font-semibold hover:bg-red-100 transition-colors border border-red-200"
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
