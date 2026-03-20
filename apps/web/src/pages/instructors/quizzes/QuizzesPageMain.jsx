import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import * as QuizHooks from "../../../hooks/quizHook/quizHooks.js";
import { CreateQuizFormButton } from "../../../components/ui/buttons/CreateQuizFormButton.jsx";
import { supabase } from "../../../supabaseClient.js";

export const QuizzesPageMain = () => {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [filter, setFilter] = useState(location.state?.filter || "pending");
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
      toast.success("Sections assigned successfully!");
    } catch (error) {
      toast.error("Failed to save section assignments: " + error.message);
    } finally {
      setSectionSaving(false);
    }
  };

  const filteredQuizzes =
    quizzes?.filter((quiz) => {
      if (filter === "archived") return quiz.is_archived;

      // Ignore archived quizzes in other views
      if (quiz.is_archived) return false;

      if (filter === "pending") return quiz.admin_review_status === "pending";
      if (filter === "rejected") return quiz.admin_review_status === "rejected";
      if (filter === "revision")
        return quiz.admin_review_status === "revision_requested";
      if (filter === "approved")
        return quiz.admin_review_status === "approved" && !quiz.is_published;
      if (filter === "published") return quiz.is_published;
      if (filter === "drafts")
        return !quiz.admin_review_status && !quiz.is_published;

      return true;
    }) || [];

  const filterTabs = [
    {
      key: "pending",
      label: "Pending",
      activeClass: "bg-yellow-500 text-white",
    },
    {
      key: "rejected",
      label: "Rejected",
      activeClass: "bg-red-500 text-white",
    },
    {
      key: "revision",
      label: "Revision",
      activeClass: "bg-orange-500 text-white",
    },
    {
      key: "approved",
      label: "Approved",
      activeClass: "bg-emerald-600 text-white",
    },
    {
      key: "published",
      label: "Published",
      activeClass: "bg-blue-600 text-white",
    },
    { key: "drafts", label: "Drafts", activeClass: "bg-yellow-600 text-white" },
    {
      key: "archived",
      label: "Archived",
      activeClass: "bg-gray-800 text-white",
    },
  ];

  const getHeading = () => {
    if (filter === "pending") return "Pending Quizzes";
    if (filter === "rejected") return "Rejected Quizzes";
    if (filter === "revision") return "Revision Quizzes";
    if (filter === "approved") return "Approved Quizzes";
    if (filter === "published") return "Published Quizzes";
    if (filter === "drafts") return "Draft Quizzes";
    return "Archived Quizzes";
  };

  const getQuizState = (quiz) => {
    if (quiz.is_archived) return { label: "Archived", color: "bg-gray-600" };
    if (quiz.is_published) {
      return { label: "Published", color: "bg-blue-600" };
    }
    if (quiz.admin_review_status === "approved") {
      return { label: "Approved", color: "bg-emerald-600" };
    }
    if (quiz.admin_review_status === "revision_requested") {
      return { label: "Revision", color: "bg-orange-600" };
    }
    if (quiz.admin_review_status === "rejected") {
      return { label: "Rejected", color: "bg-red-600" };
    }
    if (quiz.admin_review_status === "pending") {
      return { label: "Pending", color: "bg-yellow-600" };
    }
    if (!quiz.is_published) return { label: "Draft", color: "bg-yellow-600" };
    return { label: "Published", color: "bg-blue-600" };
  };

  return (
    <div className="p-6">
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

      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 rounded-full font-medium transition-colors whitespace-nowrap ${
              filter === tab.key
                ? tab.activeClass
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          {getHeading()}
        </h2>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-casual-green"></div>
          </div>
        ) : filteredQuizzes.length === 0 ? (
          <div className="bg-white rounded-lg p-12 text-center shadow-sm border border-gray-200">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              No Quizzes Found
            </h3>
            <p className="text-gray-500">
              No quizzes match the current filter.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredQuizzes.map((quiz) => {
              const state = getQuizState(quiz);

              return (
                <div
                  key={quiz.id}
                  className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden group flex flex-col"
                >
                  <div
                    className={`h-32 group-hover:opacity-90 transition-opacity flex items-center justify-center relative 
                  ${
                    quiz.is_archived
                      ? "bg-gradient-to-r from-gray-400 to-gray-500"
                      : quiz.admin_review_status === "approved"
                        ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
                        : quiz.admin_review_status === "revision_requested"
                          ? "bg-gradient-to-r from-orange-400 to-orange-500"
                          : quiz.admin_review_status === "rejected"
                            ? "bg-gradient-to-r from-red-400 to-red-500"
                            : quiz.admin_review_status === "pending"
                              ? "bg-gradient-to-r from-yellow-400 to-yellow-500"
                              : !quiz.is_published
                                ? "bg-gradient-to-r from-yellow-400 to-yellow-500"
                                : "bg-gradient-to-r from-blue-400 to-blue-500"
                  }`}
                  >
                    <div
                      className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-semibold text-white ${state.color}`}
                    >
                      {state.label}
                    </div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <h3 className="font-bold text-lg text-gray-800 mb-2 truncate">
                      {quiz.title}
                    </h3>
                    <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                      {quiz.description || "No description"}
                    </p>
                    {(quiz.admin_review_status === "rejected" ||
                      quiz.admin_review_status === "revision_requested") && (
                      <div
                        className={`mb-3 rounded-md border px-3 py-2 text-xs ${
                          quiz.admin_review_status === "rejected"
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-orange-200 bg-orange-50 text-orange-700"
                        }`}
                      >
                        <span className="font-semibold">Admin feedback: </span>
                        {quiz.admin_review_feedback?.trim() ||
                          "No feedback provided yet."}
                      </div>
                    )}
                    <div className="flex justify-between text-sm text-gray-500 mb-4 mt-auto">
                      <span>{quiz.questions_count || 0} Questions</span>
                      <span>{quiz.attempts || 0} Attempts</span>
                    </div>
                    <div className="flex gap-2">
                      {filter === "published" ? (
                        <button
                          onClick={() =>
                            navigate(
                              `/instructor-dashboard/quiz-results/${quiz.id}`,
                            )
                          }
                          className="flex-1 bg-blue-600 text-white py-2 rounded text-sm font-semibold hover:bg-blue-700 transition-colors"
                        >
                          Results
                        </button>
                      ) : (
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
                      )}
                      {filter === "approved" && (
                        <button
                          onClick={() => openAssignSectionsModal(quiz)}
                          className="relative flex-1 bg-indigo-50 text-indigo-700 py-2 rounded text-sm font-semibold hover:bg-indigo-100 transition-colors border border-indigo-200"
                        >
                          Assign to Sections
                          {(quiz.section_count || 0) > 0 && (
                            <span className="absolute -top-2 -right-2 bg-indigo-600 text-white border-2 border-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                              {quiz.section_count}
                            </span>
                          )}
                        </button>
                      )}
                      {filter === "approved" && !quiz.is_published && (
                        <button
                          onClick={() => handlePublishQuiz(quiz.id)}
                          className="flex-1 bg-emerald-600 text-white py-2 rounded text-sm font-semibold hover:bg-emerald-700 transition-colors"
                        >
                          Publish Quiz
                        </button>
                      )}
                      {filter !== "published" &&
                        (quiz.is_archived ? (
                          <button
                            onClick={() => handleRestoreQuiz(quiz.id)}
                            className="flex-1 bg-casual-green text-white py-2 rounded text-sm font-semibold hover:bg-hornblende-green transition-colors"
                          >
                            Restore
                          </button>
                        ) : (
                          <button
                            onClick={() => handleArchiveQuiz(quiz.id)}
                            className="flex-1 bg-red-50 text-red-600 py-2 rounded text-sm font-semibold hover:bg-red-100 transition-colors border border-red-200"
                          >
                            Archive
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showSectionModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => void handleCloseSectionModal()}
          />
          <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-gray-800 mb-1">
              Assign to Sections
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Select which sections this quiz should appear in.
            </p>

            {availableSections.length === 0 ? (
              <div className="text-sm text-gray-500 py-4 text-center">
                No sections available. Create one first!
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
                          {sec.section_name || sec.name || "Untitled Section"}
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
