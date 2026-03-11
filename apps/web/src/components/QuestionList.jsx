import { useState } from "react";
import { supabase } from "../supabaseClient";

export const QuestionList = ({
  filteredQuestions,
  handleAddQuestion,
  setFormData,
  setEditingId,
  setShowForm,
}) => {
  const [updatingFlag, setUpdatingFlag] = useState(null);

  // Get flag badge configuration
  const getFlagBadge = (flag) => {
    const flagConfig = {
      pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700 border-yellow-300" },
      approved: { label: "Approved", className: "bg-green-100 text-green-700 border-green-300" },
      retain: { label: "Retain", className: "bg-blue-100 text-blue-700 border-blue-300" },
      needs_revision: { label: "Needs Revision", className: "bg-orange-100 text-orange-700 border-orange-300" },
      discard: { label: "Discard", className: "bg-red-100 text-red-700 border-red-300" },
    };
    
    const config = flagConfig[flag] || flagConfig.pending;
    return (
      <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase border ${config.className}`}>
        {config.label}
      </span>
    );
  };

  // Handle flag change
  const handleFlagChange = async (questionId, newFlag) => {
    if (updatingFlag) return;
    
    setUpdatingFlag(questionId);
    try {
      const { error } = await supabase
        .from("questions")
        .update({
          flag: newFlag,
          updated_at: new Date().toISOString(),
        })
        .eq("id", questionId);

      if (error) {
        console.error("Error updating flag:", error);
        alert("Failed to update flag: " + error.message);
      } else {
        // Dispatch event to refresh
        window.dispatchEvent(new Event("questions-updated"));
      }
    } catch (error) {
      console.error("Error updating flag:", error);
      alert("An error occurred while updating the flag");
    } finally {
      setUpdatingFlag(null);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {filteredQuestions.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">❓</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            No Questions Yet
          </h3>
          <p className="text-gray-500 mb-4">
            Create your first question to get started
          </p>
          <button
            onClick={handleAddQuestion}
            className="bg-casual-green text-white px-6 py-2 rounded-lg font-semibold hover:bg-hornblende-green transition-colors"
          >
            Create Question
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredQuestions.map((question) => (
            <div
              key={question.id}
              className="border-2 border-gray-200 rounded-lg p-4 hover:border-casual-green transition-colors"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm text-gray-500">
                      {question.points} points
                    </span>
                    <span className="text-gray-300">|</span>
                    {getFlagBadge(question.flag)}
                  </div>
                  <p className="text-gray-800 font-semibold">{question.text}</p>
                  {question.quiz_title && (
                    <p className="text-sm text-gray-500 mt-2">
                      From:{" "}
                      <span className="font-semibold">
                        {question.quiz_title}
                      </span>
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingId(question.id);
                      setFormData(question);
                      setShowForm(true);
                    }}
                    className="text-casual-green hover:text-hornblende-green font-semibold text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this question?")) {
                        handleDeleteQuestion(question.id);
                      }
                    }}
                    className="text-red-500 hover:text-red-700 font-semibold text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Quick Flag Actions */}
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2">Quick Actions:</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleFlagChange(question.id, "retain")}
                    disabled={updatingFlag === question.id}
                    className={`text-xs px-2 py-1 rounded border transition-colors ${
                      question.flag === "retain"
                        ? "bg-blue-500 text-white border-blue-500"
                        : "bg-white text-blue-700 border-blue-300 hover:bg-blue-50"
                    }`}
                  >
                    ✓ Retain
                  </button>
                  <button
                    onClick={() => handleFlagChange(question.id, "needs_revision")}
                    disabled={updatingFlag === question.id}
                    className={`text-xs px-2 py-1 rounded border transition-colors ${
                      question.flag === "needs_revision"
                        ? "bg-orange-500 text-white border-orange-500"
                        : "bg-white text-orange-700 border-orange-300 hover:bg-orange-50"
                    }`}
                  >
                    ✎ Needs Revision
                  </button>
                  <button
                    onClick={() => handleFlagChange(question.id, "discard")}
                    disabled={updatingFlag === question.id}
                    className={`text-xs px-2 py-1 rounded border transition-colors ${
                      question.flag === "discard"
                        ? "bg-red-500 text-white border-red-500"
                        : "bg-white text-red-700 border-red-300 hover:bg-red-50"
                    }`}
                  >
                    ✕ Discard
                  </button>
                  <button
                    onClick={() => handleFlagChange(question.id, "pending")}
                    disabled={updatingFlag === question.id}
                    className={`text-xs px-2 py-1 rounded border transition-colors ${
                      question.flag === "pending" || !question.flag
                        ? "bg-yellow-500 text-white border-yellow-500"
                        : "bg-white text-yellow-700 border-yellow-300 hover:bg-yellow-50"
                    }`}
                  >
                    ↺ Reset to Pending
                  </button>
                </div>
              </div>

              {/* Show Options Preview for MCQ */}
              {question.type === "mcq" && question.options && (
                <div className="mt-3 ml-4 text-sm text-gray-600">
                  <p className="font-semibold mb-2">Options:</p>
                  <ul className="space-y-1">
                    {question.options.map((opt, idx) => (
                      <li
                        key={idx}
                        className={
                          idx === question.correctAnswer
                            ? "text-casual-green font-semibold"
                            : ""
                        }
                      >
                        {idx + 1}. {opt}
                        {idx === question.correctAnswer && (
                          <span className="ml-2">✓</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Helper function for delete
async function handleDeleteQuestion(id) {
  try {
    const { error } = await supabase
      .from("questions")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting question:", error);
      alert("Failed to delete question: " + error.message);
      return;
    }

    alert("Question deleted successfully!");
    window.dispatchEvent(new Event("questions-updated"));
  } catch (error) {
    console.error("Error deleting question:", error);
    alert("An error occurred while deleting the question");
  }
}
