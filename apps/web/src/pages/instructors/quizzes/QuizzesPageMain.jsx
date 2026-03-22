import React, { useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import * as QuizHooks from "../../../hooks/quizHook/quizHooks.js";
import { CreateQuizFormButton } from "../../../components/ui/buttons/CreateQuizFormButton.jsx";
import { supabase } from "../../../supabaseClient.js";

export const QuizzesPageMain = () => {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [filter, setFilter] = useState(location.state?.filter || "all");
  const [search, setSearch] = useState("");
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [selectedSectionIds, setSelectedSectionIds] = useState([]);
  const [availableSections, setAvailableSections] = useState([]);
  const [sectionTargetQuiz, setSectionTargetQuiz] = useState(null);
  const [sectionSaving, setSectionSaving] = useState(false);
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
        return (
          !quiz.is_published &&
          !!quiz.admin_review_status
        );
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
      result = result.filter((quiz) =>
        quiz.title?.toLowerCase().includes(q),
      );
    }
    return result;
  }, [quizzes, filter, search]);

  const filterTabs = [
    { key: "all", label: "All", activeClass: "bg-hornblende-green text-white" },
    { key: "drafts", label: "Drafts", activeClass: "bg-yellow-500 text-white" },
    { key: "in_review", label: "In Review", activeClass: "bg-indigo-600 text-white" },
    { key: "published", label: "Published", activeClass: "bg-blue-600 text-white" },
    { key: "archived", label: "Archived", activeClass: "bg-gray-700 text-white" },
  ];

  // ── Quiz state badge ──
  const getQuizState = (quiz) => {
    if (quiz.is_archived) return { label: "Archived", bg: "bg-gray-100 text-gray-600 border-gray-300" };
    if (quiz.is_published) return { label: "Published", bg: "bg-blue-100 text-blue-700 border-blue-300" };
    if (quiz.admin_review_status === "approved") return { label: "Approved", bg: "bg-green-100 text-green-700 border-green-300" };
    if (quiz.admin_review_status === "revision_requested") return { label: "Revision", bg: "bg-orange-100 text-orange-700 border-orange-300" };
    if (quiz.admin_review_status === "rejected") return { label: "Rejected", bg: "bg-red-100 text-red-700 border-red-300" };
    if (quiz.admin_review_status === "pending") return { label: "Pending", bg: "bg-yellow-100 text-yellow-700 border-yellow-300" };
    return { label: "Draft", bg: "bg-gray-100 text-gray-600 border-gray-300" };
  };

  const getCardGradient = (quiz) => {
    if (quiz.is_archived) return "from-gray-400 to-gray-500";
    if (quiz.is_published) return "from-blue-400 to-blue-500";
    if (quiz.admin_review_status === "approved") return "from-emerald-400 to-emerald-500";
    if (quiz.admin_review_status === "revision_requested") return "from-orange-400 to-orange-500";
    if (quiz.admin_review_status === "rejected") return "from-red-400 to-red-500";
    if (quiz.admin_review_status === "pending") return "from-yellow-400 to-yellow-500";
    return "from-yellow-400 to-yellow-500";
  };

  // ── Empty state messages ──
  const getEmptyState = () => {
    switch (filter) {
      case "drafts":
        return {
          icon: "📝",
          title: "No Drafts",
          message: "You don't have any draft quizzes. Click \"+ Create Quiz\" to get started!",
        };
      case "in_review":
        return {
          icon: "📋",
          title: "No Quizzes In Review",
          message: "None of your quizzes are currently in the review pipeline. Submit a draft to get started.",
        };
      case "published":
        return {
          icon: "🚀",
          title: "No Published Quizzes",
          message: "You haven't published any quizzes yet. Once approved, assign to sections and publish!",
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
            : "You haven't created any quizzes yet. Click \"+ Create Quiz\" to get started!",
        };
    }
  };

  // ── Section modal ──
  const openAssignSectionsModal = async (quiz) => {
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        toast.error("Please sign in again.");
        return;
      }

      const [{ data: sectionsData, error: sectionsError }, { data: qsData }] =
        await Promise.all([
          supabase
            .from("sections")
            .select("*")
            .eq("instructor_id", authUser.id),
          supabase
            .from("quiz_sections")
            .select("section_id")
            .eq("quiz_id", quiz.id),
        ]);

      if (sectionsError) throw sectionsError;

      setAvailableSections(sectionsData || []);
      setSectionTargetQuiz(quiz);

      if (qsData && qsData.length > 0) {
        setSelectedSectionIds(qsData.map((d) => d.section_id));
      } else if (quiz.section_id) {
        setSelectedSectionIds([quiz.section_id]);
      } else {
        setSelectedSectionIds([]);
      }

      setShowSectionModal(true);
    } catch (error) {
      toast.error("Failed to load sections: " + error.message);
    }
  };

  const handleCloseSectionModal = async () => {
    if (!sectionTargetQuiz) {
      setShowSectionModal(false);
      return;
    }

    setSectionSaving(true);
    try {
      const { error: deleteError } = await supabase
        .from("quiz_sections")
        .delete()
        .eq("quiz_id", sectionTargetQuiz.id);

      if (deleteError) throw deleteError;

      if (selectedSectionIds.length > 0) {
        const rows = selectedSectionIds.map((sectionId) => ({
          quiz_id: sectionTargetQuiz.id,
          section_id: sectionId,
        }));

        const { error: insertError } = await supabase
          .from("quiz_sections")
          .insert(rows);

        if (insertError) throw insertError;
      }

      const { error: updateError } = await supabase
        .from("quizzes")
        .update({ section_id: selectedSectionIds[0] || null })
        .eq("id", sectionTargetQuiz.id);

      if (updateError) throw updateError;

      await fetchQuizzes();
      setShowSectionModal(false);
      setSectionTargetQuiz(null);
      toast.success("Subject sections assigned successfully!");
    } catch (error) {
      toast.error("Failed to save section assignments: " + error.message);
    } finally {
      setSectionSaving(false);
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
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
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-full text-sm focus:outline-none focus:border-hornblende-green focus:ring-2 focus:ring-hornblende-green/20"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
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
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-casual-green"></div>
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
                quiz.admin_review_status === "approved" && !quiz.is_published;

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
                    <h3 className="font-bold text-lg text-white pr-20 leading-snug line-clamp-2">
                      {quiz.title}
                    </h3>
                    {quiz.description && (
                      <p className="text-white/70 text-xs mt-1 line-clamp-1">
                        {quiz.description}
                      </p>
                    )}
                  </div>

                  {/* Card Body */}
                  <div className="p-4 flex-1 flex flex-col gap-3">
                    {/* Admin Feedback Inline */}
                    {(quiz.admin_review_status === "rejected" ||
                      quiz.admin_review_status === "revision_requested") && (
                      <div
                        className={`rounded-lg border px-3 py-2 text-xs ${
                          quiz.admin_review_status === "rejected"
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-orange-200 bg-orange-50 text-orange-700"
                        }`}
                      >
                        <span className="font-bold">Admin Feedback: </span>
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
                      <span>
                        <span className="font-semibold text-gray-700">
                          {quiz.attempts || 0}
                        </span>{" "}
                        Attempts
                      </span>
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
                            className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
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
                          {isApproved ? "View" : "Edit"}
                        </button>
                      )}

                      {/* Approved: Assign + Publish */}
                      {isApproved && (
                        <>
                          <button
                            onClick={() => openAssignSectionsModal(quiz)}
                            className="relative flex-1 bg-indigo-50 text-indigo-700 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-100 transition-colors border border-indigo-200"
                          >
                            Assign
                            {(quiz.section_count || 0) > 0 && (
                              <span className="absolute -top-2 -right-2 bg-indigo-600 text-white border-2 border-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                {quiz.section_count}
                              </span>
                            )}
                          </button>
                          <button
                            onClick={() => handlePublishQuiz(quiz.id)}
                            className="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors"
                          >
                            Publish
                          </button>
                        </>
                      )}

                      {/* Archive / Restore */}
                      {quiz.is_archived ? (
                        <button
                          onClick={() => handleRestoreQuiz(quiz.id)}
                          className="flex-1 bg-casual-green text-white py-2 rounded-lg text-sm font-semibold hover:bg-hornblende-green transition-colors"
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

      {/* Section Assignment Modal */}
      {showSectionModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => void handleCloseSectionModal()}
          />
          <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-gray-800 mb-1">
              Assign to Subjects
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Select which subjects this quiz should appear in.
            </p>

            {availableSections.length === 0 ? (
              <div className="text-sm text-gray-500 py-4 text-center">
                No subjects available. Create one first!
              </div>
            ) : (
              <>
                <label className="flex items-center gap-3 border-b border-gray-200 pb-3 mb-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={
                      selectedSectionIds.length === availableSections.length
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedSectionIds(
                          availableSections.map((s) => s.id),
                        );
                      } else {
                        setSelectedSectionIds([]);
                      }
                    }}
                    className="form-checkbox h-4 w-4 text-casual-green border-gray-300 rounded"
                  />
                  <span className="text-sm font-semibold text-gray-800">
                    Select All
                  </span>
                  <span className="ml-auto text-xs text-gray-400">
                    {selectedSectionIds.length}/{availableSections.length}
                  </span>
                </label>

                <div className="max-h-64 overflow-y-auto space-y-2">
                  {availableSections.map((sec) => (
                    <label
                      key={sec.id}
                      className={`flex items-center gap-3 border p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedSectionIds.includes(sec.id)
                          ? "border-casual-green bg-green-50"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedSectionIds.includes(sec.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSectionIds([
                              ...selectedSectionIds,
                              sec.id,
                            ]);
                          } else {
                            setSelectedSectionIds(
                              selectedSectionIds.filter((id) => id !== sec.id),
                            );
                          }
                        }}
                        className="form-checkbox h-4 w-4 text-casual-green border-gray-300 rounded"
                      />
                      <div>
                        <span className="block text-sm font-medium text-gray-800">
                          {sec.section_name || sec.name || "Untitled Subject"}
                        </span>
                        {sec.description && (
                          <span className="block text-xs text-gray-500">
                            {sec.description}
                          </span>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </>
            )}

            <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-200">
              <button
                onClick={() => void handleCloseSectionModal()}
                disabled={sectionSaving}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sectionSaving ? "Saving..." : "Done"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
