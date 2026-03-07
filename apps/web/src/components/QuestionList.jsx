import { supabase } from "../supabaseClient";

export const QuestionList = ({
  filteredQuestions,
  handleAddQuestion,
  setFormData,
  setEditingId,
  setShowForm,
  handleDeleteQuestion,
}) => {
  
  const handleQuickFlagChange = async (questionId, newFlag) => {
    try {
      const { error } = await supabase
        .from("questions")
        .update({ flag: newFlag, updated_at: new Date().toISOString() })
        .eq("id", questionId);

      if (error) {
        console.error("Error updating flag:", error);
        alert("Failed to update flag");
        return;
      }

      // Dispatch event to refresh questions
      window.dispatchEvent(new Event('questions-updated'));
    } catch (error) {
      console.error("Error updating flag:", error);
      alert("Failed to update flag");
    }
  };

  const getFlagBadge = (flag) => {
    const flagConfig = {
      pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700 border-yellow-300" },
      approved: { label: "Approved", className: "bg-green-100 text-green-700 border-green-300" },
      needs_revision: { label: "Needs Revision", className: "bg-orange-100 text-orange-700 border-orange-300" },
      retain: { label: "Retain", className: "bg-green-100 text-green-700 border-green-300" },
      discard: { label: "Discard", className: "bg-red-100 text-red-700 border-red-300" },
    };
    
    const config = flagConfig[flag] || flagConfig.pending;
    return (
      <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase border ${config.className}`}>
        {config.label}
      </span>
    );
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
                      setFormData({
                        ...question,
                        correctAnswer: parseInt(question.correct_answer) || 0,
                      });
                      setShowForm(true);
                    }}
                    className="text-casual-green hover:text-hornblende-green font-semibold text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteQuestion(question.id)}
                    className="text-red-500 hover:text-red-700 font-semibold text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Quick Flag Actions */}
              <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
                <span className="text-xs text-gray-500 self-center mr-2">Quick Flag:</span>
                <button
                  onClick={() => handleQuickFlagChange(question.id, "retain")}
                  className={`px-2 py-1 text-xs rounded border transition-colors ${
                    question.flag === "retain" || question.flag === "approved"
                      ? "bg-green-500 text-white border-green-600"
                      : "bg-white text-green-700 border-green-300 hover:bg-green-50"
                  }`}
                >
                  ✓ Retain
                </button>
                <button
                  onClick={() => handleQuickFlagChange(question.id, "needs_revision")}
                  className={`px-2 py-1 text-xs rounded border transition-colors ${
                    question.flag === "needs_revision"
                      ? "bg-orange-500 text-white border-orange-600"
                      : "bg-white text-orange-700 border-orange-300 hover:bg-orange-50"
                  }`}
                >
                  ⚠ Needs Revision
                </button>
                <button
                  onClick={() => handleQuickFlagChange(question.id, "discard")}
                  className={`px-2 py-1 text-xs rounded border transition-colors ${
                    question.flag === "discard"
                      ? "bg-red-500 text-white border-red-600"
                      : "bg-white text-red-700 border-red-300 hover:bg-red-50"
                  }`}
                >
                  ✕ Discard
                </button>
                <button
                  onClick={() => handleQuickFlagChange(question.id, "pending")}
                  className={`px-2 py-1 text-xs rounded border transition-colors ${
                    question.flag === "pending"
                      ? "bg-yellow-500 text-white border-yellow-600"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  ○ Pending
                </button>
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
                          idx === parseInt(question.correct_answer)
                            ? "text-casual-green font-semibold"
                            : ""
                        }
                      >
                        {idx + 1}. {opt}
                        {idx === parseInt(question.correct_answer) && (
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
