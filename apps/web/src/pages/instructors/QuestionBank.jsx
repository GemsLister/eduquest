import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../supabaseClient.js";
import { useQuestionBank } from "../../hooks/questionHook/useQuestionBank.jsx";

export const QuestionBank = () => {
  const navigate = useNavigate();
  const { quizId } = useParams();
  const [activeTab, setActiveTab] = useState("active"); // "active" or "archived" or "import"
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [importing, setImporting] = useState(false);

  const {
    activeQuestions,
    archivedQuestions,
    loading,
    archiveQuestion,
    restoreQuestion,
    deleteQuestion,
    addToBank,
    fetchQuestions,
  } = useQuestionBank();

  // Form state for adding new question
  const [newQuestion, setNewQuestion] = useState({
    text: "",
    type: "mcq",
    options: ["", ""],
    correctAnswer: 0,
    points: 1,
  });

  // Filter questions by search term
  const filterQuestions = (questions) => {
    if (!searchTerm) return questions;
    return questions.filter(
      (q) =>
        q.text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.quizzes?.title?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const displayedQuestions =
    activeTab === "active"
      ? filterQuestions(activeQuestions)
      : activeTab === "archived"
        ? filterQuestions(archivedQuestions)
        : filterQuestions(activeQuestions); // Import tab shows active questions

  // Handle adding new question to bank
  const handleAddToBank = async () => {
    if (!newQuestion.text.trim()) {
      alert("Question text is required");
      return;
    }

    if (newQuestion.type === "mcq" && newQuestion.options.some((o) => !o.trim())) {
      alert("All options must be filled");
      return;
    }

    const result = await addToBank(newQuestion);
    if (result.success) {
      alert("Question added to bank!");
      setNewQuestion({
        text: "",
        type: "mcq",
        options: ["", ""],
        correctAnswer: 0,
        points: 1,
      });
      setShowAddForm(false);
    } else {
      alert("Error: " + result.error);
    }
  };

  // Handle importing selected questions to a quiz
  const handleImportToQuiz = async () => {
    if (!quizId) {
      alert("No quiz selected for import");
      return;
    }

    if (selectedQuestions.length === 0) {
      alert("Please select at least one question to import");
      return;
    }

    setImporting(true);
    try {
      // Get max order index for positioning
      const { data: existingQuestions } = await supabase
        .from("questions")
        .select("id")
        .eq("quiz_id", quizId);

      let orderIndex = existingQuestions?.length || 0;

      // Import each selected question
      for (const q of selectedQuestions) {
        const { error } = await supabase.from("questions").insert({
          quiz_id: quizId,
          type: q.type,
          text: q.text,
          options: q.options,
          correct_answer:
            q.type === "mcq"
              ? q.options[q.correctAnswer]
              : q.type === "true_false"
                ? q.correctAnswer === 0
                  ? "true"
                  : "false"
                : q.correctAnswer,
          points: q.points,
        });

        if (error) throw error;
        orderIndex++;
      }

      alert(`Successfully imported ${selectedQuestions.length} question(s) to the quiz!`);
      setSelectedQuestions([]);
      
      // Navigate to quiz editor
      navigate(`/instructor-dashboard/instructor-quiz/${quizId}`);
    } catch (error) {
      console.error("Error importing questions:", error);
      alert("Error importing questions: " + error.message);
    } finally {
      setImporting(false);
    }
  };

  // Toggle question selection for import
  const toggleQuestionSelection = (question) => {
    setSelectedQuestions((prev) => {
      const isSelected = prev.some((q) => q.id === question.id);
      if (isSelected) {
        return prev.filter((q) => q.id !== question.id);
      } else {
        return [...prev, question];
      }
    });
  };

  // Add/remove option
  const addOption = () => {
    setNewQuestion((prev) => ({
      ...prev,
      options: [...prev.options, ""],
    }));
  };

  const removeOption = (index) => {
    if (newQuestion.options.length <= 2) {
      alert("Minimum 2 options required");
      return;
    }
    setNewQuestion((prev) => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index),
    }));
  };

  const updateOption = (index, value) => {
    setNewQuestion((prev) => ({
      ...prev,
      options: prev.options.map((opt, i) => (i === index ? value : opt)),
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-casual-green"></div>
          <p className="mt-4 text-hornblende-green font-semibold">Loading questions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-authentic-white p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="text-casual-green font-semibold mb-2 hover:underline"
          >
            ← Back
          </button>
          <h1 className="text-3xl font-bold text-hornblende-green mb-2">
            Question Bank
          </h1>
          <p className="text-gray-600">
            {quizId
              ? "Select questions to import to your quiz"
              : "Archive and manage your questions for reuse"}
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-casual-green text-white px-6 py-3 rounded-lg font-semibold hover:bg-hornblende-green transition-colors"
        >
          + Add to Bank
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab("active")}
          className={`px-6 py-3 font-semibold ${
            activeTab === "active"
              ? "text-casual-green border-b-2 border-casual-green"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Active Questions ({activeQuestions.length})
        </button>
        <button
          onClick={() => setActiveTab("archived")}
          className={`px-6 py-3 font-semibold ${
            activeTab === "archived"
              ? "text-casual-green border-b-2 border-casual-green"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Archived ({archivedQuestions.length})
        </button>
        {quizId && (
          <button
            onClick={() => setActiveTab("import")}
            className={`px-6 py-3 font-semibold ${
              activeTab === "import"
                ? "text-casual-green border-b-2 border-casual-green"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Import to Quiz ({selectedQuestions.length} selected)
          </button>
        )}
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search questions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-casual-green focus:ring-2 focus:ring-casual-green focus:ring-opacity-20"
        />
      </div>

      {/* Import Action Bar */}
      {activeTab === "import" && quizId && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-300 rounded-lg flex justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={handleSelectAllToggle}
                className="mr-2 h-5 w-5 text-casual-green rounded"
              />
              <span className="text-blue-800 font-semibold text-sm">
                Select All ({displayedQuestions.length})
              </span>
            </label>
            <span className="text-blue-600 font-semibold">
              {selectedQuestions.length} / {displayedQuestions.length} selected
            </span>
          </div>
          <button
            onClick={handleImportToQuiz}
            disabled={importing || selectedQuestions.length === 0}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing ? "Importing..." : `Import ${selectedQuestions.length} Questions`}
          </button>
        </div>
      )}

      {/* Questions List */}
      {displayedQuestions.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 text-lg">
            {searchTerm ? "No questions match your search" : "No questions yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedQuestions.map((question) => (
            <div
              key={question.id}
              className={`bg-white border-2 rounded-lg p-4 ${
                activeTab === "import" && selectedQuestions.some((q) => q.id === question.id)
                  ? "border-casual-green bg-green-50"
                  : "border-gray-200 hover:border-casual-green"
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  {/* Import checkbox */}
                  {activeTab === "import" && (
                    <input
                      type="checkbox"
                      checked={selectedQuestions.some((q) => q.id === question.id)}
                      onChange={() => toggleQuestionSelection(question)}
                      className="mr-3 h-5 w-5 text-casual-green"
                    />
                  )}

                  <div className="inline">
                    <span className="text-sm text-gray-500 mr-2">
                      {question.quizzes?.title || "Draft Quiz"}
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        question.type === "mcq"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-purple-100 text-purple-700"
                      }`}
                    >
                      {question.type?.toUpperCase()}
                    </span>
                    <span className="text-xs ml-2 text-gray-500">
                      {question.points} point(s)
                    </span>
                  </div>

                  <h3 className="text-lg font-semibold text-gray-800 mt-1">
                    {question.text}
                  </h3>

                  {/* Options Preview */}
                  {question.type === "mcq" && question.options && (
                    <div className="mt-2 space-y-1">
                      {question.options.map((opt, idx) => (
                        <div
                          key={idx}
                          className={`text-sm ${
                            opt === question.correct_answer
                              ? "text-green-600 font-semibold"
                              : "text-gray-600"
                          }`}
                        >
                          {idx + 1}. {opt}
                          {opt === question.correct_answer && " ✓"}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 ml-4">
                  {activeTab === "active" && (
                    <>
                      <button
                        onClick={() => archiveQuestion(question.id)}
                        className="text-yellow-600 hover:text-yellow-800 text-sm font-semibold px-3 py-1"
                        title="Archive this question"
                      >
                        📁 Archive
                      </button>
                      {quizId && (
                        <button
                          onClick={() => {
                            setSelectedQuestions([question]);
                            setActiveTab("import");
                          }}
                          className="text-blue-600 hover:text-blue-800 text-sm font-semibold px-3 py-1"
                        >
                          📥 Import
                        </button>
                      )}
                    </>
                  )}
                  {activeTab === "archived" && (
                    <>
                      <button
                        onClick={() => restoreQuestion(question.id)}
                        className="text-green-600 hover:text-green-800 text-sm font-semibold px-3 py-1"
                        title="Restore this question"
                      >
                        ♻️ Restore
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Are you sure you want to permanently delete this question?")) {
                            deleteQuestion(question.id);
                          }
                        }}
                        className="text-red-600 hover:text-red-800 text-sm font-semibold px-3 py-1"
                        title="Permanently delete"
                      >
                        🗑️ Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Question Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-hornblende-green">
                  Add Question to Bank
                </h2>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Question Type */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Question Type
                </label>
                <select
                  value={newQuestion.type}
                  onChange={(e) => setNewQuestion({ ...newQuestion, type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="mcq">Multiple Choice</option>
                  <option value="true_false">True/False</option>
                </select>
              </div>

              {/* Question Text */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Question Text *
                </label>
                <textarea
                  value={newQuestion.text}
                  onChange={(e) => setNewQuestion({ ...newQuestion, text: e.target.value })}
                  placeholder="Enter your question"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-casual-green"
                />
              </div>

              {/* Options for MCQ */}
              {newQuestion.type === "mcq" && (
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Options *
                  </label>
                  <div className="space-y-2">
                    {newQuestion.options.map((option, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input
                          type="radio"
                          name="correct-answer"
                          checked={newQuestion.correctAnswer === idx}
                          onChange={() =>
                            setNewQuestion({ ...newQuestion, correctAnswer: idx })
                          }
                          className="mt-3"
                        />
                        <input
                          type="text"
                          value={option}
                          onChange={(e) => updateOption(idx, e.target.value)}
                          placeholder={`Option ${idx + 1}`}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                        />
                        {newQuestion.options.length > 2 && (
                          <button
                            onClick={() => removeOption(idx)}
                            className="text-red-500 px-3"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={addOption}
                    className="text-casual-green font-semibold mt-2"
                  >
                    + Add Option
                  </button>
                </div>
              )}

              {/* True/False */}
              {newQuestion.type === "true_false" && (
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Correct Answer
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="tf-answer"
                        checked={newQuestion.correctAnswer === 0}
                        onChange={() =>
                          setNewQuestion({ ...newQuestion, correctAnswer: 0 })
                        }
                        className="mr-2"
                      />
                      <span>True</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="tf-answer"
                        checked={newQuestion.correctAnswer === 1}
                        onChange={() =>
                          setNewQuestion({ ...newQuestion, correctAnswer: 1 })
                        }
                        className="mr-2"
                      />
                      <span>False</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Points */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Points
                </label>
                <input
                  type="number"
                  value={newQuestion.points}
                  onChange={(e) =>
                    setNewQuestion({ ...newQuestion, points: parseInt(e.target.value) || 1 })
                  }
                  min={1}
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-4">
                <button
                  onClick={handleAddToBank}
                  className="flex-1 bg-casual-green text-white px-6 py-3 rounded-lg font-semibold hover:bg-hornblende-green transition-colors"
                >
                  Add to Bank
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 bg-gray-300 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

