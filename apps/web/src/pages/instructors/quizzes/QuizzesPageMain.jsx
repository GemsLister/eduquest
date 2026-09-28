import React, { useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import * as QuizHooks from "../../../hooks/quizHook/quizHooks.js";
import { CreateQuizFormButton } from "../../../components/ui/buttons/CreateQuizFormButton.jsx";
import { useAuth } from "../../../context/AuthContext.jsx";

const getAssessmentTermBadge = (quiz) => {
  const term = (quiz?.term || "").toLowerCase();
  const title = (quiz?.title || "").toLowerCase();

  if (term === "prelims" || title.includes("prelim")) {
    return { label: "Prelims", bg: "bg-amber-500/20 text-white border-amber-300/40", icon: "📝" };
  }
  if (term === "midterms" || title.includes("midterm")) {
    return { label: "Midterms", bg: "bg-blue-500/20 text-white border-blue-300/40", icon: "📘" };
  }
  if (term === "final term" || term === "finals" || title.includes("final")) {
    return { label: "Final Term", bg: "bg-emerald-500/20 text-white border-emerald-300/40", icon: "🎓" };
  }
  return { label: "Exam", bg: "bg-indigo-500/20 text-white border-indigo-300/40", icon: "📄" };
};

export const QuizzesPageMain = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [filter, setFilter] = useState(location.state?.filter || "all");
  const [termFilter, setTermFilter] = useState("all");
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

  const filterQuizByTerm = (quiz, termKey) => {
    if (termKey === "all") return true;
    const title = (quiz.title || "").toLowerCase();
    const description = (quiz.description || "").toLowerCase();
    const term = (quiz.term || "").toLowerCase();

    if (termKey === "prelims") {
      return term === "prelims" || title.includes("prelim") || description.includes("prelim");
    }
    if (termKey === "midterms") {
      return term === "midterms" || title.includes("midterm") || description.includes("midterm");
    }
    if (termKey === "final_term") {
      return term === "final term" || term === "finals" || title.includes("final") || description.includes("final");
    }
    return true;
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
    let result = quizzes?.filter((quiz) => filterQuiz(quiz, filter) && filterQuizByTerm(quiz, termFilter)) || [];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((quiz) => quiz.title?.toLowerCase().includes(q));
    }
    return result;
  }, [quizzes, filter, termFilter, search]);

  const filterTabs = [
    { key: "all", label: "All Statuses", activeClass: "bg-brand-navy text-white" },
    {
      key: "drafts",
      label: "Drafts",
      activeClass: "bg-brand-gold text-brand-navy",
    },
    {
      key: "in_review",
      label: "In Review",
      activeClass: "bg-brand-navy text-white",
    },
    {
      key: "published",
      label: "Published",
      activeClass: "bg-brand-indigo text-white",
    },
    {
      key: "archived",
      label: "Archived",
      activeClass: "bg-gray-700 text-white",
    },
  ];

  const termFilterTabs = [
    { key: "all", label: "All Terms", icon: "🌐" },
    { key: "prelims", label: "Prelims", icon: "📝" },
    { key: "midterms", label: "Midterms", icon: "📘" },
    { key: "final_term", label: "Final Term", icon: "🎓" },
  ];

  // ── Quiz state badge ──
  const getQuizState = (quiz) => {
    if (quiz.is_archived)
      return {
        label: "Archived",
        bg: "bg-gray-100 text-gray-600 border-gray-300",
      };
    if (quiz.is_published)
      return {
        label: "Published",
        bg: "bg-brand-indigo/10 text-brand-indigo border-brand-indigo/30",
      };
    if (
      quiz.admin_review_status === "approved" ||
      quiz.admin_review_status === "faculty_head_approved"
    )
      return {
        label: "Approved",
        bg: "bg-green-100 text-green-700 border-green-300",
      };
    if (quiz.admin_review_status === "faculty_head_review")
      return {
        label: "Department Head Review",
        bg: "bg-blue-100 text-blue-700 border-blue-300",
      };
    if (quiz.admin_review_status === "revision_requested")
      return {
        label: "Revision",
        bg: "bg-orange-100 text-orange-700 border-orange-300",
      };
    if (quiz.admin_review_status === "pending")
      return {
        label: "Pending",
        bg: "bg-yellow-100 text-yellow-700 border-yellow-300",
      };
    return { label: "Draft", bg: "bg-gray-100 text-gray-600 border-gray-300" };
  };

  const getCardGradient = (quiz) => {
    if (quiz.is_archived) return "from-gray-400 to-gray-500";
    if (quiz.is_published) return "from-brand-navy to-brand-indigo";
    if (
      quiz.admin_review_status === "approved" ||
      quiz.admin_review_status === "faculty_head_approved"
    )
      return "from-brand-navy to-brand-indigo-dark";
    if (quiz.admin_review_status === "faculty_head_review")
      return "from-blue-600 to-blue-700";
    if (quiz.admin_review_status === "revision_requested")
      return "from-amber-600 to-amber-700";
    if (quiz.admin_review_status === "pending")
      return "from-brand-gold to-brand-gold-dark";
    return "from-brand-gold to-brand-gold-dark";
  };

  const getCardTextColor = (quiz) => {
    if (!quiz.is_archived && !quiz.is_published && !quiz.admin_review_status)
      return "text-brand-navy";
    if (quiz.admin_review_status === "pending" && !quiz.is_published)
      return "text-brand-navy";
    return "text-white";
  };

  // ── Empty state messages ──
  const getEmptyState = () => {
    switch (filter) {
      case "drafts":
        return {
          icon: "📝",
          title: "No Draft Assessments",
          message:
            'You don\'t have any draft assessments. Click "+ Create Assessment / Exam" to get started!',
        };
      case "in_review":
        return {
          icon: "📋",
          title: "No Assessments In Review",
          message:
            "None of your assessments are currently in the review pipeline. Submit a draft to get started.",
        };
      case "published":
        return {
          icon: "🚀",
          title: "No Published Assessments",
          message:
            "You haven't published any assessments yet. Once approved, assign to sections and publish!",
        };
      case "archived":
        return {
          icon: "📦",
          title: "No Archived Assessments",
          message: "You don't have any archived assessments.",
        };
      default:
        return {
          icon: "📝",
          title: "No Assessments Found",
          message: search.trim()
            ? `No assessments match "${search.trim()}".`
            : 'You haven\'t created any assessments yet. Click "+ Create Assessment / Exam" to get started!',
        };
    }
  };

  return (
    <>
      {/* Hero Banner */}
      <div className="bg-brand-navy px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white">
              Assessment &amp; Exam Management
            </h1>
            <p className="text-white/60 text-sm mt-1">
              Create and manage Prelims, Midterms, Final Term examinations, and Quizzes
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
        <div className="mb-6 space-y-3">
          {/* Term Filter Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs font-bold text-slate-500 uppercase shrink-0 mr-1">Term Filter:</span>
            {termFilterTabs.map((tTab) => (
              <button
                key={tTab.key}
                onClick={() => setTermFilter(tTab.key)}
                className={`px-3.5 py-1.5 rounded-full font-bold transition-all whitespace-nowrap text-xs flex items-center gap-1.5 ${
                  termFilter === tTab.key
                    ? "bg-brand-navy text-white shadow-xs ring-2 ring-brand-navy/20"
                    : "bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200"
                }`}
              >
                <span>{tTab.icon}</span>
                <span>{tTab.label}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Bar */}
            <div className="relative flex-1 max-w-sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
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
                placeholder="Search assessments (Prelims, Midterms, Finals)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-full text-sm focus:outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/20"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
                  className={`px-4 py-2 rounded-full font-medium transition-colors whitespace-nowrap text-sm flex items-center gap-1.5 ${
                    filter === tab.key
                      ? tab.activeClass
                      : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {tab.label}
                  {counts[tab.key] > 0 && (
                    <span
                      className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold ${
                        filter === tab.key
                          ? "bg-white/25 text-white"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {counts[tab.key]}
                    </span>
                  )}
                </button>
              ))}
            </div>
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
                <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-200">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brand-navy/5 flex items-center justify-center text-brand-navy">
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
                const termBadge = getAssessmentTermBadge(quiz);
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
                    className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden group flex flex-col"
                  >
                    {/* Card Header */}
                    <div
                      className={`px-5 py-4 bg-gradient-to-r group-hover:opacity-95 transition-opacity ${getCardGradient(quiz)}`}
                    >
                      {/* Term & Subject Row */}
                      <div className="flex items-center gap-1.5 flex-wrap text-xs font-semibold mb-1 opacity-95">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border backdrop-blur-xs flex items-center gap-1 ${termBadge.bg}`}>
                          <span>{termBadge.icon}</span>
                          <span>{termBadge.label}</span>
                        </span>
                        {quiz.subject_display && (
                          <span className="px-2.5 py-0.5 rounded-md bg-white/20 backdrop-blur-xs text-white text-[11px] font-black tracking-wide uppercase flex items-center gap-1 shadow-xs border border-white/20">
                            <span>📖</span>
                            <span className="truncate max-w-[180px]">{quiz.subject_display}</span>
                          </span>
                        )}
                      </div>

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
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-300"
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
                        {/* Privacy / Visibility Badge */}
                        {(() => {
                          const vis = quiz.visibility || (quiz.is_shared ? "shared" : (quiz.is_private !== false ? "private" : "public"));
                          if (vis === "shared" || quiz.is_shared) {
                            return (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-purple-800/80 text-purple-100 border-purple-500">
                                Shared
                              </span>
                            );
                          }
                          if (vis === "private" || quiz.is_private !== false) {
                            return (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-gray-800/80 text-gray-100 border-gray-600">
                                Private
                              </span>
                            );
                          }
                          return (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-800/80 text-emerald-100 border-emerald-600">
                              Public
                            </span>
                          );
                        })()}
                        {/* Status Badge */}
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${state.bg}`}
                        >
                          {state.label}
                        </span>
                        {/* Version Badge */}
                        {(quiz.version_number || 1) === 1 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/30 text-white">
                            Original
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white">
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
                      {/* Subject Row */}
                      <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-indigo-50/80 px-3 py-2 rounded-lg border border-indigo-100">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        <span className="font-semibold text-slate-500">Subject:</span>
                        <span className="font-extrabold text-indigo-950 truncate">
                          {quiz.subject_display || quiz.subject_name || (quiz.subjects ? (quiz.subjects.code ? `${quiz.subjects.code} - ${quiz.subjects.name}` : quiz.subjects.name) : (quiz.section_name || quiz.source_section_name || "Unassigned Subject"))}
                        </span>
                      </div>

                      {/* Owner Row */}
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200/80">
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
                        <div className="rounded-lg border px-3 py-2 text-xs border-orange-200 bg-orange-50 text-orange-700">
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
                              className="flex-1 bg-brand-navy text-white py-2 rounded-lg text-sm font-semibold hover:bg-brand-indigo transition-colors"
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
                              className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors"
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
                            className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors"
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
                            className="flex-1 bg-brand-gold text-brand-navy py-2 rounded-lg text-sm font-semibold hover:bg-brand-gold-dark transition-colors"
                          >
                            Publish
                          </button>
                        )}

                        {/* Archive / Restore */}
                        {quiz.is_archived ? (
                          <button
                            onClick={() => handleRestoreQuiz(quiz.id)}
                            className="flex-1 bg-brand-gold text-brand-navy py-2 rounded-lg text-sm font-semibold hover:bg-brand-gold-dark transition-colors"
                          >
                            Restore
                          </button>
                        ) : (
                          <button
                            onClick={() => handleArchiveQuiz(quiz.id)}
                            className="px-3 py-2 rounded-lg text-xs font-semibold bg-red-50 text-red-500 hover:bg-red-100 border border-red-200 transition-colors flex items-center gap-1"
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
