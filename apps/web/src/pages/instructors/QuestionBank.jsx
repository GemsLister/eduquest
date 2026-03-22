import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useConfirm } from "../../components/ui/ConfirmModal.jsx";
import { supabase } from "../../supabaseClient.js";
import { useQuestionBank } from "../../hooks/questionHook/useQuestionBank.jsx";

export const QuestionBank = () => {
  const navigate = useNavigate();
  const { quizId } = useParams();
  const confirm = useConfirm();
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

  // Filter questions by search term and exclude current quiz questions
  const filterQuestions = (questions) => {
    let filteredList = questions;

    // Do not show questions that belong to the current quiz,
    // or exact duplicates of what is already in this quiz.
    if (quizId) {
      const currentQuizTexts = new Set(
        activeQuestions
          .filter((q) => String(q.quiz_id) === String(quizId))
          .map((q) => q.text?.toLowerCase().trim()),
      );

      filteredList = filteredList.filter(
        (q) =>
          String(q.quiz_id) !== String(quizId) &&
          !currentQuizTexts.has(q.text?.toLowerCase().trim()),
      );
    }

    if (!searchTerm) return filteredList;

    return filteredList.filter(
      (q) =>
        q.text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.quizzes?.title?.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  };

  const displayedQuestions =
    activeTab === "active"
      ? filterQuestions(activeQuestions)
      : activeTab === "archived"
        ? filterQuestions(archivedQuestions)
        : filterQuestions(activeQuestions); // Import tab shows active questions

  const selectAll =
    displayedQuestions.length > 0 &&
    selectedQuestions.length === displayedQuestions.length;

  const handleSelectAllToggle = () => {
    if (selectAll) {
      setSelectedQuestions([]);
    } else {
      setSelectedQuestions([...displayedQuestions]);
    }
  };

  // Handle adding new question to bank
  const handleAddToBank = async () => {
    if (!newQuestion.text.trim()) {
      toast.warning("Question text is required");
      return;
    }

    if (
      newQuestion.type === "mcq" &&
      newQuestion.options.some((o) => !o.trim())
    ) {
      toast.warning("All options must be filled");
      return;
    }

    const result = await addToBank(newQuestion);
    if (result.success) {
      toast.success("Question added to bank!");
      setNewQuestion({
        text: "",
        type: "mcq",
        options: ["", ""],
        correctAnswer: 0,
        points: 1,
      });
      setShowAddForm(false);
    } else {
      toast.error("Error: " + result.error);
    }
  };

  // Handle importing selected questions to a quiz
  const handleImportToQuiz = async () => {
    if (!quizId) {
      toast.warning("No quiz selected for import");
      return;
    }

    if (selectedQuestions.length === 0) {
      toast.warning("Please select at least one question to import");
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

      toast.success(
        `Successfully imported ${selectedQuestions.length} question(s) to the quiz!`,
      );
      setSelectedQuestions([]);

      // Navigate to quiz editor
      navigate(`/instructor-dashboard/instructor-quiz/${quizId}`);
    } catch (error) {
      console.error("Error importing questions:", error);
      toast.error("Error importing questions: " + error.message);
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
      toast.warning("Minimum 2 options required");
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
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand-gold"></div>
          <p className="mt-4 text-brand-navy font-semibold">
            Loading questions...
          </p>
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
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-brand-navy/10 hover:bg-brand-navy/20 text-brand-navy text-sm font-semibold rounded-lg transition-colors mb-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            Back
          </button>
          <h1 className="text-3xl font-bold text-brand-navy mb-2">
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
          className="bg-brand-gold text-brand-navy px-6 py-3 rounded-lg font-semibold hover:bg-brand-gold-dark transition-colors"
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
              ? "text-brand-gold border-b-2 border-brand-gold"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Active Questions ({activeQuestions.length})
        </button>
        <button
          onClick={() => setActiveTab("archived")}
          className={`px-6 py-3 font-semibold ${
            activeTab === "archived"
              ? "text-brand-gold border-b-2 border-brand-gold"
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
                ? "text-brand-gold border-b-2 border-brand-gold"
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
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold focus:ring-opacity-20"
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
                className="mr-2 h-5 w-5 text-brand-gold rounded"
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
            {importing
              ? "Importing..."
              : `Import ${selectedQuestions.length} Questions`}
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
              onClick={
                activeTab === "import"
                  ? () => toggleQuestionSelection(question)
                  : undefined
              }
              className={`transition-colors bg-white border-2 rounded-lg p-4 ${
                activeTab === "import" ? "cursor-pointer " : ""
              }${
                activeTab === "import" &&
                selectedQuestions.some((q) => q.id === question.id)
                  ? "border-brand-gold bg-green-50"
                  : "border-gray-200 hover:border-brand-gold"
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  {/* Import checkbox */}
                  {activeTab === "import" && (
                    <input
                      type="checkbox"
                      checked={selectedQuestions.some(
                        (q) => q.id === question.id,
                      )}
                      onChange={(e) => {}}
                      className="mr-3 h-5 w-5 text-brand-gold pointer-events-none"
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
                        className="text-yellow-600 hover:text-yellow-800 text-sm font-semibold px-3 py-1 flex items-center gap-1"
                        title="Archive this question"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                        Archive
                      </button>
                      {quizId && (
                        <button
                          onClick={() => {
                            setSelectedQuestions([question]);
                            setActiveTab("import");
                          }}
                          className="text-brand-navy hover:text-brand-indigo text-sm font-semibold px-3 py-1 flex items-center gap-1"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          Import
                        </button>
                      )}
                    </>
                  )}
                  {activeTab === "archived" && (
                    <>
                      <button
                        onClick={() => restoreQuestion(question.id)}
                        className="text-green-600 hover:text-green-800 text-sm font-semibold px-3 py-1 flex items-center gap-1"
                        title="Restore this question"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        Restore
                      </button>
                      <button
                        onClick={async () => {
                          const confirmed = await confirm({
                            title: "Remove Question Permanently",
                            message:
                              "Are you sure you want to permanently remove this question?",
                            confirmText: "Remove",
                            cancelText: "Cancel",
                            variant: "danger",
                          });
                          if (confirmed) {
                            deleteQuestion(question.id);
                          }
                        }}
                        className="text-red-600 hover:text-red-800 text-sm font-semibold px-3 py-1 flex items-center gap-1"
                        title="Permanently remove"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        Remove
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
                <h2 className="text-2xl font-bold text-brand-navy">
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
                  onChange={(e) =>
                    setNewQuestion({ ...newQuestion, type: e.target.value })
                  }
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
                  onChange={(e) =>
                    setNewQuestion({ ...newQuestion, text: e.target.value })
                  }
                  placeholder="Enter your question"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-gold"
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
                            setNewQuestion({
                              ...newQuestion,
                              correctAnswer: idx,
                            })
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
                    className="text-brand-gold font-semibold mt-2"
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
                    setNewQuestion({
                      ...newQuestion,
                      points: parseInt(e.target.value) || 1,
                    })
                  }
                  min={1}
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-4">
                <button
                  onClick={handleAddToBank}
                  className="flex-1 bg-brand-gold text-brand-navy px-6 py-3 rounded-lg font-semibold hover:bg-brand-gold-dark transition-colors"
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
