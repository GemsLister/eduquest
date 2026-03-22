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
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand-gold"></div>
          <p className="mt-4 text-brand-navy font-semibold">Loading...</p>
        </div>
      </div>
    );
  }

  if (!section) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-600">Subject not found</p>
      </div>
    );
  }

  const sectionName = section.section_name || section.name;
  const openCount = quizzes.filter((q) => q.is_open !== false).length;
  const totalAttempts = quizzes.reduce((sum, q) => sum + (q.attempts || 0), 0);

  return (
    <>
      {/* Hero Banner */}
      <div className="bg-brand-navy px-6 py-8">
        <button
          onClick={() => navigate("/instructor-dashboard")}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold rounded-lg transition-colors mb-4"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Back to Subjects
        </button>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-brand-gold text-sm font-semibold uppercase tracking-widest mb-1">
              Subject
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
              <p className="text-white/60 text-xs font-semibold">Quizzes</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-lg px-4 py-2 text-center">
              <p className="text-2xl font-black text-white">{openCount}</p>
              <p className="text-white/60 text-xs font-semibold">Open</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-lg px-4 py-2 text-center">
              <p className="text-2xl font-black text-white">{totalAttempts}</p>
              <p className="text-white/60 text-xs font-semibold">Attempts</p>
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
