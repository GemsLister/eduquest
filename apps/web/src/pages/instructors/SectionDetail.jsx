import { useNavigate } from "react-router-dom";
import * as QuizHooks from "../../hooks/quizHook/quizHooks.js";
import * as Quiz from "./quizzes/quizIndex.js";

export const SectionDetail = () => {
  const navigate = useNavigate();
  const {
    fetchQuizzes,
    section,
    quizzes = [],
    loading,
  } = QuizHooks.useFetchQuizzes();

  const { handleArchiveQuiz, archivingQuizId } =
    QuizHooks.useArchiveQuiz(fetchQuizzes);
  const { handleToggleAccess, togglingQuizId } =
    QuizHooks.useToggleQuizAccess(fetchQuizzes);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-casual-green"></div>
          <p className="mt-4 text-hornblende-green font-semibold">Loading...</p>
        </div>
      </div>
    );
  }

  if (!section) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-600">Section not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-8">
        <button
          onClick={() => navigate("/instructor-dashboard")}
          className="text-casual-green font-semibold mb-4 hover:underline"
        >
          ← Back to Sections
        </button>
        <h1 className="text-4xl font-bold text-gray-800 mb-2">
          {section.section_name || section.name}
        </h1>
        <p className="text-gray-600">
          Subject: {section.description || "No description provided"}
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Exam Code: <span className="font-semibold">{section.exam_code}</span>
        </p>
      </div>

      {/* Main Content */}
      <div className="px-6 py-6">
        {/* Quizzes List */}
        <Quiz.QuizzesList
          quizzes={quizzes}
          handleArchive={handleArchiveQuiz}
          archivingQuizId={archivingQuizId}
          handleToggleAccess={handleToggleAccess}
          togglingQuizId={togglingQuizId}
        />
      </div>
    </div>
  );
};
