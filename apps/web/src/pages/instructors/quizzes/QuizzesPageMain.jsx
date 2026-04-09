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
    if (key === "archived") return quiz.is_archived;
    if (quiz.is_archived) return false;

    switch (key) {
      case "all":
        return true;
      case "drafts":
        return !quiz.admin_review_status && !quiz.is_published;
      case "in_review":
        return !quiz.is_published && !!quiz.admin_review_status;
      case "published":
        return quiz.is_published;
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
    { key: "all", label: "All", activeClass: "bg-brand-navy text-white" },
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

  return (
    <>
      {/* Hero Banner */}
      <div className="bg-brand-navy px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white">
              Quiz Management
            </h1>
            <p className="text-white/60 text-sm mt-1">
              Create, manage, and restore your quizzes
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
              placeholder="Search quizzes..."
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
                <div className="bg-white rounded-lg p-12 text-center shadow-sm border border-gray-200">
                  <div className="text-6xl mb-4">{empty.icon}</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">
                    {empty.title}
                  </h3>
                  <p className="text-gray-500">{empty.message}</p>
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

                return (
                  <div
                    key={quiz.id}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden group flex flex-col"
                  >
                    {/* Card Header */}
                    <div
                      className={`px-5 py-4 relative bg-gradient-to-r group-hover:opacity-95 transition-opacity ${getCardGradient(quiz)}`}
                    >
                      <span
                        className={`absolute top-3 right-3 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${state.bg}`}
                      >
                        {state.label}
                      </span>
                      <h3
                        className={`font-bold text-lg pr-20 leading-snug line-clamp-2 ${getCardTextColor(quiz)}`}
                      >
                        {quiz.title?.replace(
                          /\s*\(Revised(?:\s+\d+)?\)\s*$/,
                          "",
                        )}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        {quiz.version_number && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white">
                            v{quiz.version_number}
                          </span>
                        )}
                        {quiz.description && (
                          <p
                            className={`text-xs line-clamp-1 ${getCardTextColor(quiz)} opacity-70`}
                          >
                            {quiz.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-4 flex-1 flex flex-col gap-3">
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
                                  `/instructor-dashboard/quiz-results/${quiz.id}`,
                                )
                              }
                              className="flex-1 bg-brand-navy text-white py-2 rounded-lg text-sm font-semibold hover:bg-brand-indigo transition-colors"
                            >
                              Results
                            </button>
                            <button
                              onClick={() =>
                                navigate(
                                  `/instructor-dashboard/instructor-quiz/${quiz.id}`,
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
                                `/instructor-dashboard/instructor-quiz/${quiz.id}`,
                              )
                            }
                            className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors"
                          >
                            {isApproved || isReviewLocked ? "View" : "Edit"}
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
