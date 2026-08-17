import React, { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as QuizHooks from "../../hooks/quizHook/quizHooks.js";
import * as Quiz from "./quizzes/quizIndex.js";

export const SectionDetail = () => {
  const navigate = useNavigate();
  const { sectionId } = useParams();
  const [quizScope, setQuizScope] = useState("mine"); // "mine" (default) or "all_published"
  const {
    fetchQuizzes,
    section,
    quizzes = [],
    loading,
    user,
  } = QuizHooks.useFetchQuizzes();

  const { handleArchiveQuiz, archivingQuizId } =
    QuizHooks.useArchiveQuiz(fetchQuizzes);
  const { handleToggleAccess, togglingQuizId } =
    QuizHooks.useToggleQuizAccess(fetchQuizzes);

  // Filter quizzes based on scope: "mine" (default) vs "all_published"
  const myPublishedQuizzes = useMemo(() => {
    const currentSectionId = sectionId || section?.id;
    return quizzes.filter((q) => {
      const isPublished = q.is_published;
      const isMine = (q.instructor_id || q.owner_id) === user?.id;
      const isAssignedToThisSection =
        (q.quiz_sections &&
          Array.isArray(q.quiz_sections) &&
          q.quiz_sections.some(
            (qs) => String(qs.section_id) === String(currentSectionId)
          )) ||
        (q.section_id && String(q.section_id) === String(currentSectionId)) ||
        !q.source_section_name;

      return isPublished && isMine && isAssignedToThisSection;
    });
  }, [quizzes, user, sectionId, section]);

  const allPublishedQuizzes = useMemo(() => {
    return quizzes.filter((q) => q.is_published);
  }, [quizzes]);

  const displayedQuizzes =
    quizScope === "mine" ? myPublishedQuizzes : allPublishedQuizzes;

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
  const openCount = displayedQuizzes.filter((q) => q.is_open !== false).length;
  const totalAttempts = displayedQuizzes.reduce(
    (sum, q) => sum + (q.attempts || 0),
    0
  );

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
              Subject Overview
            </p>
            <h1 className="text-2xl md:text-3xl font-black text-white">
              {sectionName}
            </h1>
            <p className="text-white/60 text-sm mt-1">
              {section.description || "No subject description specified"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-white/15 backdrop-blur-sm rounded-lg px-4 py-2 text-center">
              <p className="text-2xl font-black text-white">{displayedQuizzes.length}</p>
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

      {/* Scope Switcher / Filter Control Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-brand-navy flex items-center gap-2">
            <span>📚 Subject Quizzes</span>
          </h2>
          <p className="text-xs text-gray-500">
            {quizScope === "mine"
              ? "Showing published quizzes created by you for this subject"
              : "Showing all published quizzes related to this subject"}
          </p>
        </div>

        {/* Segmented Control Pill */}
        <div className="inline-flex p-1 bg-gray-100/90 rounded-full border border-gray-200 shadow-inner">
          <button
            onClick={() => setQuizScope("mine")}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-200 flex items-center gap-2 ${
              quizScope === "mine"
                ? "bg-brand-navy text-white shadow-md transform scale-[1.02]"
                : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
            }`}
          >
            <span>👤 My Published</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                quizScope === "mine"
                  ? "bg-brand-gold text-brand-navy"
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              {myPublishedQuizzes.length}
            </span>
          </button>

          <button
            onClick={() => setQuizScope("all_published")}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-200 flex items-center gap-2 ${
              quizScope === "all_published"
                ? "bg-brand-indigo text-white shadow-md transform scale-[1.02]"
                : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
            }`}
          >
            <span>🌐 All Published in Subject</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                quizScope === "all_published"
                  ? "bg-white/25 text-white"
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              {allPublishedQuizzes.length}
            </span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        {quizScope === "mine" && myPublishedQuizzes.length === 0 && allPublishedQuizzes.length > 0 && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-800 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-xl">💡</span>
              <span>
                You haven't published any quizzes for this subject yet, but there are <strong>{allPublishedQuizzes.length}</strong> published quiz(zes) shared in this subject.
              </span>
            </div>
            <button
              onClick={() => setQuizScope("all_published")}
              className="px-4 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition-colors whitespace-nowrap cursor-pointer"
            >
              View All Published Quizzes
            </button>
          </div>
        )}

        <Quiz.QuizzesList
          quizzes={displayedQuizzes}
          handleArchive={handleArchiveQuiz}
          archivingQuizId={archivingQuizId}
          handleToggleAccess={handleToggleAccess}
          togglingQuizId={togglingQuizId}
          currentSectionId={section.id}
        />
      </div>
    </>
  );
};
