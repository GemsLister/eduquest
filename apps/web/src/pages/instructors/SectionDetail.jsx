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

  const sectionName = section.section_name || section.name;
  const openCount = quizzes.filter((q) => q.is_open !== false).length;
  const totalAttempts = quizzes.reduce((sum, q) => sum + (q.attempts || 0), 0);

  return (
    <>
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-hornblende-green via-emerald-700 to-hornblende-green px-6 py-8">
        <button
          onClick={() => navigate("/instructor-dashboard")}
          className="text-emerald-200 hover:text-white font-semibold mb-4 flex items-center gap-1 transition-colors"
        >
          ← Back to Sections
        </button>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-emerald-200 text-sm font-semibold uppercase tracking-widest mb-1">
              Section
            </p>
            <h1 className="text-2xl md:text-3xl font-black text-white">
              {sectionName}
            </h1>
            <p className="text-white/60 text-sm mt-1">
              {section.description || "No subject specified"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-white/15 backdrop-blur-sm rounded-lg px-4 py-2 text-center">
              <p className="text-2xl font-black text-white">{quizzes.length}</p>
              <p className="text-emerald-200 text-xs font-semibold">Quizzes</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-lg px-4 py-2 text-center">
              <p className="text-2xl font-black text-white">{openCount}</p>
              <p className="text-emerald-200 text-xs font-semibold">Open</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-lg px-4 py-2 text-center">
              <p className="text-2xl font-black text-white">{totalAttempts}</p>
              <p className="text-emerald-200 text-xs font-semibold">Attempts</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-lg px-4 py-3 text-center">
              <p className="text-xs text-emerald-200 font-semibold mb-0.5">Exam Code</p>
              <p className="text-lg font-black text-white tracking-wider">
                {section.exam_code}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        <Quiz.QuizzesList
          quizzes={quizzes}
          handleArchive={handleArchiveQuiz}
          archivingQuizId={archivingQuizId}
          handleToggleAccess={handleToggleAccess}
          togglingQuizId={togglingQuizId}
        />
      </div>
    </>
  );
};
