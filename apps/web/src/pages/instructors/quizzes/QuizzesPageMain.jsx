import React, { useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import * as QuizHooks from "../../../hooks/quizHook/quizHooks.js";
import { CreateQuizFormButton } from "../../../components/ui/buttons/CreateQuizFormButton.jsx";
import { useAuth } from "../../../context/AuthContext.jsx";

export const QuizzesPageMain = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [filter, setFilter] = useState(location.state?.filter || "all");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const {
    quizFormData,
    showQuizForm,
    handleCreateQuiz,
    setQuizFormData,
    isSubmitting,
    availableSections,
  } = QuizHooks.useCreateQuiz({ user: user || {} });

  const {
    quizzes,
    loading,
    fetchQuizzes,
    handleRestoreQuiz,
    handleArchiveQuiz,
    handlePublishQuiz,
  } = QuizHooks.useFetchInstructorQuizzes();

  // ── Filter logic ──
  const filterQuiz = (quiz, key) => {
    if (key === "archived") return Boolean(quiz.is_archived);
    if (quiz.is_archived) return false;

    switch (key) {
      case "all":
        return true;
      case "drafts":
        return !quiz.is_published && (!quiz.admin_review_status || quiz.admin_review_status === "draft");
      case "in_review":
        return !quiz.is_published && Boolean(quiz.admin_review_status) && quiz.admin_review_status !== "draft";
      case "published":
        return Boolean(quiz.is_published);
      default:
        return true;
    }
  };

  // ── Badge counts ──
  const counts = useMemo(() => {
    if (!quizzes) return {};
    return {
      all: quizzes.filter((q) => !q.is_archived).length,
      drafts: quizzes.filter((q) => filterQuiz(q, "drafts")).length,
      in_review: quizzes.filter((q) => filterQuiz(q, "in_review")).length,
      published: quizzes.filter((q) => filterQuiz(q, "published")).length,
      archived: quizzes.filter((q) => filterQuiz(q, "archived")).length,
    };
  }, [quizzes]);

  const filteredQuizzes = useMemo(() => {
    let result = quizzes?.filter((quiz) => filterQuiz(quiz, filter)) || [];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((quiz) => quiz.title?.toLowerCase().includes(q));
    }
    return result;
  }, [quizzes, filter, search]);

  const filterTabs = [
    { key: "all", label: "All" },
    { key: "drafts", label: "Drafts" },
    { key: "in_review", label: "In Review" },
    { key: "published", label: "Published" },
    { key: "archived", label: "Archived" },
  ];

  // ── Quiz state badge ──
  const getQuizState = (quiz) => {
    if (quiz.is_archived)
      return {
        label: "Archived",
        bg: "bg-slate-500/20 text-slate-200 border-slate-400/30",
      };
    if (quiz.is_published)
      return {
        label: "Published",
        bg: "bg-emerald-500/20 text-emerald-200 border-emerald-400/30",
      };
    if (
      quiz.admin_review_status === "approved" ||
      quiz.admin_review_status === "faculty_head_approved"
    )
      return {
        label: "Approved",
        bg: "bg-emerald-500/20 text-emerald-200 border-emerald-400/30",
      };
    if (quiz.admin_review_status === "faculty_head_review")
      return {
        label: "Department Head Review",
        bg: "bg-blue-500/20 text-blue-200 border-blue-400/30",
      };
    if (quiz.admin_review_status === "revision_requested")
      return {
        label: "Revision",
        bg: "bg-rose-500/20 text-rose-200 border-rose-400/30",
      };
    if (quiz.admin_review_status === "pending")
      return {
        label: "Pending",
        bg: "bg-amber-500/20 text-amber-200 border-amber-400/30",
      };
    return { label: "Draft", bg: "bg-white/20 text-white border-white/25" };
  };

  const getCardGradient = (quiz) => {
    if (quiz.is_archived) return "from-slate-700 to-slate-800";
    if (quiz.is_published) return "from-brand-navy via-brand-navy to-brand-indigo";
    if (
      quiz.admin_review_status === "approved" ||
      quiz.admin_review_status === "faculty_head_approved"
    )
      return "from-brand-navy to-brand-indigo-dark";
    if (quiz.admin_review_status === "faculty_head_review")
      return "from-slate-800 via-brand-navy to-brand-indigo-dark";
    if (quiz.admin_review_status === "revision_requested")
      return "from-slate-800 to-slate-900";
    if (quiz.admin_review_status === "pending")
      return "from-brand-navy to-slate-800";
    return "from-brand-navy to-brand-indigo";
  };

  const getCardTextColor = () => "text-white";

  // ── Empty state messages ──
  const getEmptyState = () => {
    switch (filter) {
      case "drafts":
        return {
          icon: "📝",
          title: "No Drafts",
          message:
            'You don\'t have any draft quizzes. Click "+ Create Quiz" to get started!',
        };
      case "in_review":
        return {
          icon: "📋",
          title: "No Quizzes In Review",
          message:
            "None of your quizzes are currently in the review pipeline. Submit a draft to get started.",
        };
      case "published":
        return {
          icon: "🚀",
          title: "No Published Quizzes",
          message:
            "You haven't published any quizzes yet. Once approved, assign to sections and publish!",
        };
      case "archived":
        return {
          icon: "📦",
          title: "No Archived Quizzes",
          message: "You don't have any archived quizzes.",
        };
      default:
        return {
          icon: "📝",
          title: "No Quizzes Found",
          message: search.trim()
            ? `No quizzes match "${search.trim()}".`
            : 'You haven\'t created any quizzes yet. Click "+ Create Quiz" to get started!',
        };
    }
  };

  const isAdminPath = location.pathname.startsWith("/admin-dashboard");

  return (
    <>
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-brand-navy to-brand-indigo px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-brand-gold text-xs font-bold tracking-widest uppercase mb-1">
              {isAdminPath ? "Senior Faculty" : "Instructor Portal"}
            </p>
            <h1 className="text-2xl md:text-3xl font-black text-white">
              My Quizzes
            </h1>
            <p className="text-white/60 text-sm mt-1">
              {quizzes?.length || 0} total {quizzes?.length === 1 ? "quiz" : "quizzes"} · Create, manage, and publish assessments
            </p>
          </div>
          <CreateQuizFormButton
            onCreateQuiz={handleCreateQuiz}
            quizFormData={quizFormData}
            setQuizFormData={setQuizFormData}
            isSubmitting={isSubmitting}
            availableSections={availableSections}
          />
        </div>
      </div>

      <div className="p-6">
        {/* Search + Filter Row */}
        <div className="mb-6 flex flex-col sm:flex-row gap-3">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search quizzes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 transition-all shadow-xs"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-4 py-2.5 rounded-xl font-bold transition-all whitespace-nowrap text-xs flex items-center gap-1.5 cursor-pointer border ${
                  filter === tab.key
                    ? "bg-brand-navy text-white border-brand-navy shadow-xs"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-2xs"
                }`}
              >
                {tab.label}
                {counts[tab.key] > 0 && (
                  <span
                    className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                      filter === tab.key
                        ? "bg-white/25 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {counts[tab.key]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Quiz Grid */}
        <div>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-gold"></div>
            </div>
          ) : filteredQuizzes.length === 0 ? (
            (() => {
              const empty = getEmptyState();
              return (
                <div className="bg-white rounded-2xl p-12 text-center shadow-xs border border-gray-200">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-brand-navy/5 flex items-center justify-center text-brand-navy">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-brand-navy mb-2">
                    {empty.title}
                  </h3>
                  <p className="text-gray-500 max-w-md mx-auto text-sm">{empty.message}</p>
                </div>
              );
            })()
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredQuizzes.map((quiz) => {
                const state = getQuizState(quiz);
                const isApproved =
                  (quiz.admin_review_status === "approved" ||
                    quiz.admin_review_status === "faculty_head_approved") &&
                  !quiz.is_published;
                const isReviewLocked =
                  quiz.admin_review_status === "pending" ||
                  quiz.admin_review_status === "faculty_head_review";
                const isOutdatedVersion =
                  !quiz.is_archived && quiz.hasNewerVersion;

                return (
                  <div
                    key={quiz.id}
                    className="bg-white rounded-2xl border border-gray-200 shadow-xs hover:shadow-md transition-all overflow-hidden group flex flex-col"
                  >
                    {/* Card Header */}
                    <div
                      className={`px-5 py-4 bg-gradient-to-r group-hover:opacity-95 transition-opacity ${getCardGradient(quiz)}`}
                    >
                      <h3
                        className={`font-bold text-lg leading-snug line-clamp-2 mb-2 ${getCardTextColor(quiz)}`}
                      >
                        {quiz.title?.replace(
                          /\s*\(Revised(?:\s+\d+)?\)\s*$/,
                          "",
                        )}
                      </h3>

                      <div className="flex items-center flex-wrap gap-1.5">
                        {/* Collaboration Badge */}
                        {quiz.owner_id && quiz.owner_id !== user?.id && (
                          <span
                            className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-300"
                            title={`Shared by ${quiz.owner_name || 'another instructor'}`}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-3 w-3 inline mr-0.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                            </svg>
                            Shared
                          </span>
                        )}
                        {/* Privacy Badge */}
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            quiz.is_private !== false
                              ? "bg-slate-800/80 text-slate-200 border-slate-600"
                              : "bg-emerald-800/80 text-emerald-100 border-emerald-600"
                          }`}
                        >
                          {quiz.is_private !== false ? "Private" : "Public"}
                        </span>
                        {/* Status Badge */}
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${state.bg}`}
                        >
                          {state.label}
                        </span>
                        {/* Version Badge */}
                        {(quiz.version_number || 1) === 1 ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white border border-white/25">
                            Original
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white border border-white/25">
                            v{quiz.version_number}
                          </span>
                        )}
                      </div>

                      {quiz.description && (
                        <p
                          className={`text-xs line-clamp-1 mt-1.5 ${getCardTextColor(quiz)} opacity-70`}
                        >
                          {quiz.description}
                        </p>
                      )}
                    </div>

                    {/* Card Body */}
                    <div className="p-4 flex-1 flex flex-col gap-3">
                      {/* Owner Row */}
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/80">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="font-semibold text-slate-500">Owner:</span>
                        <span className="font-extrabold text-slate-900 truncate">
                          ({quiz.owner_name || (quiz.profiles ? `${quiz.profiles.first_name || ''} ${quiz.profiles.last_name || ''}`.trim() : null) || user?.user_metadata?.full_name || "Instructor"})
                        </span>
                      </div>

                      {/* Senior Faculty Feedback Inline */}
                      {quiz.admin_review_status === "revision_requested" && (
                        <div className="rounded-xl border px-3 py-2 text-xs border-rose-200 bg-rose-50 text-rose-700">
                          <span className="font-bold">
                            Senior Faculty Feedback:{" "}
                          </span>
                          {quiz.admin_review_feedback?.trim() ||
                            "No feedback provided yet."}
                        </div>
                      )}

                      {/* Stats Row */}
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>
                          <span className="font-semibold text-gray-700">
                            {quiz.questions_count || 0}
                          </span>{" "}
                          Questions
                        </span>
                        {quiz.is_published && (
                          <span>
                            <span className="font-semibold text-gray-700">
                              {quiz.attempts || 0}
                            </span>{" "}
                            Attempts
                          </span>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 mt-auto pt-2 border-t border-gray-100">
                        {quiz.is_published ? (
                          <>
                            <button
                              onClick={() =>
                                navigate(
                                  location.pathname.startsWith("/admin-dashboard")
                                    ? `/admin-dashboard/quiz-results/${quiz.id}`
                                    : `/instructor-dashboard/quiz-results/${quiz.id}`,
                                )
                              }
                              className="flex-1 bg-brand-navy text-white py-2 rounded-xl text-xs font-bold hover:bg-brand-indigo transition-all shadow-xs"
                            >
                              Results
                            </button>
                            <button
                              onClick={() =>
                                navigate(
                                  location.pathname.startsWith("/admin-dashboard")
                                    ? `/admin-dashboard/create-quiz/${quiz.id}`
                                    : `/instructor-dashboard/instructor-quiz/${quiz.id}`,
                                )
                              }
                              className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-xl text-xs font-bold hover:bg-slate-200 border border-slate-200 transition-all"
                            >
                              View
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() =>
                              navigate(
                                location.pathname.startsWith("/admin-dashboard")
                                  ? `/admin-dashboard/create-quiz/${quiz.id}`
                                  : `/instructor-dashboard/instructor-quiz/${quiz.id}`,
                              )
                            }
                            className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-xl text-xs font-bold hover:bg-slate-200 border border-slate-200 transition-all"
                          >
                            {isApproved || isReviewLocked || isOutdatedVersion
                              ? "View"
                              : "Edit"}
                          </button>
                        )}

                        {/* Approved: Publish */}
                        {isApproved && (
                          <button
                            onClick={() => handlePublishQuiz(quiz.id)}
                            className="flex-1 bg-brand-gold text-brand-navy py-2 rounded-xl text-xs font-bold hover:bg-brand-gold-dark transition-all shadow-xs"
                          >
                            Publish
                          </button>
                        )}

                        {/* Archive / Restore */}
                        {quiz.is_archived ? (
                          <button
                            onClick={() => handleRestoreQuiz(quiz.id)}
                            className="flex-1 bg-brand-gold text-brand-navy py-2 rounded-xl text-xs font-bold hover:bg-brand-gold-dark transition-all shadow-xs"
                          >
                            Restore
                          </button>
                        ) : (
                          <button
                            onClick={() => handleArchiveQuiz(quiz.id)}
                            className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition-all flex items-center gap-1"
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
                            <span className="hidden sm:inline">Archive</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
