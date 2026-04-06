import { useState, useEffect } from "react";
import { notify } from "../utils/notify.jsx";
import { useConfirm } from "./ui/ConfirmModal.jsx";
import { RevisionHistoryModal } from "./RevisionHistoryModal.jsx";
import { supabase } from "../supabaseClient";

// Icons
const ChevronLeftIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
  </svg>
);

const ChevronRightIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
  </svg>
);

export const QuestionList = ({
  filteredQuestions,
  handleAddQuestion,
  setFormData,
  setEditingId,
  setShowForm,
}) => {
  const [updatingFlag, setUpdatingFlag] = useState(null);
  const [showHistoryId, setShowHistoryId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 10;
  const confirm = useConfirm();

  // Pagination
  const totalPages = Math.ceil(filteredQuestions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filteredQuestions.slice(startIndex, endIndex);

  // Reset page on data change
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredQuestions]);

  // Prevent empty page after delete
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages || 1);
    }
  }, [filteredQuestions, totalPages]);

  const handlePageChange = (page) => setCurrentPage(page);
  const handlePreviousPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));
  const handleNextPage = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages));

  const handleDeleteQuestionFn = async (id) => {
    try {
      const { error } = await supabase.from("questions").delete().eq("id", id);
      if (error) throw error;

      notify.success("Question deleted successfully!");
      window.dispatchEvent(new Event("questions-updated"));
    } catch (error) {
      notify.error("Failed to delete: " + error.message);
    }
  };

  const handleFlagChange = async (questionId, newFlag) => {
    if (updatingFlag) return;
    setUpdatingFlag(questionId);

    try {
      const { error } = await supabase
        .from("questions")
        .update({ flag: newFlag, updated_at: new Date().toISOString() })
        .eq("id", questionId);

      if (error) throw error;

      window.dispatchEvent(new Event("questions-updated"));
    } catch {
      notify.error("Error updating flag");
    } finally {
      setUpdatingFlag(null);
    }
  };

  const getFlagBadge = (flag) => {
    const styles = {
      pending: "bg-yellow-100 text-yellow-700",
      approved: "bg-green-100 text-green-700",
      retain: "bg-blue-100 text-blue-700",
      needs_revision: "bg-orange-100 text-orange-700",
      discard: "bg-red-100 text-red-700",
    };

    return (
      <span className={`px-2 py-1 text-xs font-bold rounded ${styles[flag] || styles.pending}`}>
        {flag.replace("_", " ")}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {currentItems.map((question) => (
        <div key={question.id} className="border p-4 rounded mb-3">
          <p className="font-semibold">{question.text}</p>

          <div className="flex gap-2 mt-2">
            {getFlagBadge(question.flag)}

            <button onClick={() => handlePageChange(1)}>Edit</button>

            <button
              onClick={async () => {
                const confirmed = await confirm({
                  title: "Delete",
                  message: "Are you sure?",
                });
                if (confirmed) handleDeleteQuestionFn(question.id);
              }}
              className="text-red-500"
            >
              Delete
            </button>
          </div>

          <div className="flex gap-1 mt-2">
            {["approved", "needs_revision", "discard", "pending"].map((f) => (
              <button
                key={f}
                onClick={() => handleFlagChange(question.id, f)}
                className="px-2 py-1 border text-xs"
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* ✅ PAGINATION */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <button onClick={handlePreviousPage} disabled={currentPage === 1}>
            <ChevronLeftIcon className="h-5 w-5" />
          </button>

          <div className="flex gap-1">
            {(() => {
              const pages = [];
              const maxVisible = 5;

              let start = Math.max(currentPage - 2, 1);
              let end = Math.min(start + maxVisible - 1, totalPages);

              if (end - start < maxVisible - 1) {
                start = Math.max(end - maxVisible + 1, 1);
              }

              if (start > 1) {
                pages.push(
                  <button key={1} onClick={() => handlePageChange(1)}>
                    1
                  </button>
                );
                if (start > 2) pages.push(<span key="dots1">...</span>);
              }

              for (let i = start; i <= end; i++) {
                pages.push(
                  <button
                    key={i}
                    onClick={() => handlePageChange(i)}
                    className={currentPage === i ? "font-bold" : ""}
                  >
                    {i}
                  </button>
                );
              }

              if (end < totalPages) {
                if (end < totalPages - 1) pages.push(<span key="dots2">...</span>);
                pages.push(
                  <button key={totalPages} onClick={() => handlePageChange(totalPages)}>
                    {totalPages}
                  </button>
                );
              }

              return pages;
            })()}
          </div>

          <button onClick={handleNextPage} disabled={currentPage === totalPages}>
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Modal */}
      {showHistoryId && (
        <RevisionHistoryModal
          isOpen={showHistoryId !== null}
          onClose={() => setShowHistoryId(null)}
          revisions={
            filteredQuestions.find((q) => q.id === showHistoryId)
              ?.revision_history || []
          }
          questionId={showHistoryId}
        />
      )}
    </div>
  );
};