import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as QuizHooks from "../../../hooks/quizHook/quizHooks.js";
import { CreateQuizFormButton } from "../../../components/ui/buttons/CreateQuizFormButton.jsx";
import { supabase } from "../../../supabaseClient.js";

export const QuizzesPageMain = () => {
  const [user, setUser] = useState(null);
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

  const { archivedQuizzes, loading, handleRestoreQuiz } =
    QuizHooks.useFetchArchivedQuizzes();

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Your Quizzes</h1>
          <p className="text-gray-500 mt-1">Create new quizzes</p>
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

      {/* Archived Quizzes Section */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          Archived Quizzes
        </h2>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-casual-green"></div>
          </div>
        ) : archivedQuizzes.length === 0 ? (
          <div className="bg-white rounded-lg p-12 text-center shadow-sm border border-gray-200">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              No Archived Quizzes
            </h3>
            <p className="text-gray-500">
              Quizzes you archive will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {archivedQuizzes.map((quiz) => (
              <div
                key={quiz.id}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden group"
              >
                <div className="h-32 bg-gradient-to-r from-gray-400 to-gray-500 group-hover:opacity-90 transition-opacity flex items-center justify-center relative">
                  <div className="absolute top-2 right-2 px-2 py-1 rounded text-xs font-semibold text-white bg-gray-600">
                    Archived
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-lg text-gray-800 mb-2 truncate">
                    {quiz.title}
                  </h3>
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                    {quiz.description || "No description"}
                  </p>
                  <div className="flex justify-between text-sm text-gray-500 mb-4">
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
                    <button
                      onClick={() => handleRestoreQuiz(quiz.id)}
                      className="flex-1 bg-casual-green text-white py-2 rounded text-sm font-semibold hover:bg-hornblende-green transition-colors"
                    >
                      Restore
                    </button>
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
