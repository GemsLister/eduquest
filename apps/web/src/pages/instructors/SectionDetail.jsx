import React, { useState, useMemo } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import * as QuizHooks from "../../hooks/quizHook/quizHooks.js";
import * as Quiz from "./quizzes/quizIndex.js";

export const SectionDetail = () => {
  const navigate = useNavigate();
  const location = useLocation();
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

  const isAdminPath = location.pathname.startsWith("/admin-dashboard");

  return (
    <>
      {/* Hero Banner */}
      <div className="bg-brand-navy px-6 py-8">
        <button
          onClick={() => navigate(isAdminPath ? "/admin-dashboard/subjects" : "/instructor-dashboard")}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold rounded-lg transition-colors mb-4 cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Back to Subjects
        </button>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-brand-gold text-sm font-semibold uppercase tracking-widest mb-1">
              {isAdminPath ? "Senior Faculty" : "Subject Overview"}
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
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-xs">
        <div>
          <h2 className="text-base font-extrabold text-brand-navy flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-brand-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span>Subject Quizzes</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {quizScope === "mine"
              ? "Showing published quizzes created by you for this subject"
              : "Showing all published quizzes related to this subject"}
          </p>
        </div>

        {/* Segmented Control Pill */}
        <div className="inline-flex p-1 bg-slate-100 rounded-full border border-slate-200 shadow-inner">
          <button
            onClick={() => setQuizScope("mine")}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-200 flex items-center gap-2 ${
              quizScope === "mine"
                ? "bg-brand-navy text-white shadow-md transform scale-[1.02]"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>My Published</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                quizScope === "mine"
                  ? "bg-brand-gold text-brand-navy"
                  : "bg-slate-200 text-slate-700"
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
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            <span>All Published in Subject</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                quizScope === "all_published"
                  ? "bg-white/25 text-white"
                  : "bg-slate-200 text-slate-700"
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
          <div className="mb-6 p-4 bg-amber-50/80 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 text-sm shadow-xs">
            <div className="flex items-center gap-2.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                You haven't published any quizzes for this subject yet, but there are <strong>{allPublishedQuizzes.length}</strong> published quiz(zes) shared in this subject.
              </span>
            </div>
            <button
              onClick={() => setQuizScope("all_published")}
              className="px-4 py-1.5 bg-brand-navy hover:bg-brand-indigo text-white rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer shadow-2xs"
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
