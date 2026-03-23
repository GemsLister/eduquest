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
  const [selectedActiveQuestions, setSelectedActiveQuestions] = useState([]); // For bulk archive
  const [selectedArchivedQuestions, setSelectedArchivedQuestions] = useState([]); // For bulk delete
  const [importing, setImporting] = useState(false);
  const [availableQuizzes, setAvailableQuizzes] = useState([]);
  const [filterByQuizId, setFilterByQuizId] = useState(""); // Filter by subject
  const [bulkProcessing, setBulkProcessing] = useState(false);

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

  // Extract available quizzes from loaded questions (only show quizzes with questions)
  useEffect(() => {
    const quizMap = new Map();
    
    // Collect unique quizzes from active and archived questions
    [...activeQuestions, ...archivedQuestions].forEach((question) => {
      if (question.quiz_id && question.quizzes?.title) {
        if (!quizMap.has(question.quiz_id)) {
          quizMap.set(question.quiz_id, {
            id: question.quiz_id,
            title: question.quizzes.title,
          });
        }
      }
    });
    
    // Convert to array and sort by title
    const quizzes = Array.from(quizMap.values()).sort((a, b) =>
      a.title.localeCompare(b.title),
    );
    setAvailableQuizzes(quizzes);
  }, [activeQuestions, archivedQuestions]);

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

    // Apply subject/quiz filter
    if (filterByQuizId) {
      filteredList = filteredList.filter(
        (q) => String(q.quiz_id) === String(filterByQuizId),
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
    (activeTab === "import"
      ? selectedQuestions.length === displayedQuestions.length
      : activeTab === "active"
        ? selectedActiveQuestions.length === displayedQuestions.length
        : selectedArchivedQuestions.length === displayedQuestions.length);

  const handleSelectAllToggle = () => {
    if (selectAll) {
      if (activeTab === "import") {
        setSelectedQuestions([]);
      } else if (activeTab === "active") {
        setSelectedActiveQuestions([]);
      } else {
        setSelectedArchivedQuestions([]);
      }
    } else {
      if (activeTab === "import") {
        setSelectedQuestions([...displayedQuestions]);
      } else if (activeTab === "active") {
        setSelectedActiveQuestions([...displayedQuestions]);
      } else {
        setSelectedArchivedQuestions([...displayedQuestions]);
      }
    }
  };

  // Bulk archive active questions
  const handleBulkArchive = async () => {
    if (selectedActiveQuestions.length === 0) {
      toast.warning("Please select at least one question to archive");
      return;
    }

    const confirmed = await confirm({
      title: "Archive Questions",
      message: `Are you sure you want to archive ${selectedActiveQuestions.length} question(s)?`,
      confirmText: "Archive",
      cancelText: "Cancel",
      variant: "warning",
    });

    if (!confirmed) return;

    setBulkProcessing(true);
    try {
      for (const q of selectedActiveQuestions) {
        await archiveQuestion(q.id);
      }
      toast.success(
        `Successfully archived ${selectedActiveQuestions.length} question(s)!`,
      );
      setSelectedActiveQuestions([]);
      await fetchQuestions();
    } catch (error) {
      console.error("Error archiving questions:", error);
      toast.error("Error archiving questions");
    } finally {
      setBulkProcessing(false);
    }
  };

  // Bulk delete archived questions
  const handleBulkDelete = async () => {
    if (selectedArchivedQuestions.length === 0) {
      toast.warning("Please select at least one question to delete");
      return;
    }

    const confirmed = await confirm({
      title: "Delete Questions Permanently",
      message: `Are you sure you want to permanently delete ${selectedArchivedQuestions.length} question(s)? This cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
    });

    if (!confirmed) return;

    setBulkProcessing(true);
    try {
      for (const q of selectedArchivedQuestions) {
        await deleteQuestion(q.id);
      }
      toast.success(
        `Successfully deleted ${selectedArchivedQuestions.length} question(s)!`,
      );
      setSelectedArchivedQuestions([]);
      await fetchQuestions();
    } catch (error) {
      console.error("Error deleting questions:", error);
      toast.error("Error deleting questions");
    } finally {
      setBulkProcessing(false);
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
        // Determine the correct answer to save
        let correctAnswerValue = q.correct_answer || q.correctAnswer;
        
        // For MCQ questions, if correctAnswer is an index, convert to actual option text
        if (q.type === "mcq" && typeof correctAnswerValue === "number" && q.options) {
          correctAnswerValue = q.options[correctAnswerValue];
        }
        // For true/false, ensure it's stored as string "true" or "false"
        else if (q.type === "true_false") {
          if (typeof correctAnswerValue === "number") {
            correctAnswerValue = correctAnswerValue === 0 ? "true" : "false";
          }
        }

        const { error } = await supabase.from("questions").insert({
          quiz_id: quizId,
          type: q.type,
          text: q.text,
          options: q.options,
          correct_answer: correctAnswerValue,
          points: q.points || 1,
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

  // Toggle question selection for active tab
  const toggleActiveQuestionSelection = (question) => {
    setSelectedActiveQuestions((prev) => {
      const isSelected = prev.some((q) => q.id === question.id);
      if (isSelected) {
        return prev.filter((q) => q.id !== question.id);
      } else {
        return [...prev, question];
      }
    });
  };

  // Toggle question selection for archived tab
  const toggleArchivedQuestionSelection = (question) => {
    setSelectedArchivedQuestions((prev) => {
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
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-casual-green"></div>
          <p className="mt-4 text-hornblende-green font-semibold">
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

      {/* Filter and Search */}
      <div className="mb-6 space-y-4">
        {/* Subject/Quiz Filter */}
        {!quizId && (
          <div className="flex gap-4">
            <div className="flex-1 max-w-xs">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Filter by Subject
              </label>
              <select
                value={filterByQuizId}
                onChange={(e) => setFilterByQuizId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-casual-green focus:ring-2 focus:ring-casual-green focus:ring-opacity-20 bg-white"
              >
                <option value="">-- All Subjects --</option>
                {availableQuizzes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        {/* Search */}
        <div>
          <input
            type="text"
            placeholder="Search questions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-casual-green focus:ring-2 focus:ring-casual-green focus:ring-opacity-20"
          />
        </div>
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
            {importing
              ? "Importing..."
              : `Import ${selectedQuestions.length} Questions`}
          </button>
        </div>
      )}

      {/* Active Tab Action Bar */}
      {activeTab === "active" && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-300 rounded-lg flex justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={handleSelectAllToggle}
                className="mr-2 h-5 w-5 text-casual-green rounded"
              />
              <span className="text-yellow-800 font-semibold text-sm">
                Select All ({displayedQuestions.length})
              </span>
            </label>
            <span className="text-yellow-700 font-semibold">
              {selectedActiveQuestions.length} / {displayedQuestions.length}{" "}
              selected
            </span>
          </div>
          {selectedActiveQuestions.length > 0 && (
            <button
              onClick={handleBulkArchive}
              disabled={bulkProcessing}
              className="bg-yellow-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {bulkProcessing
                ? "Processing..."
                : `📁 Archive ${selectedActiveQuestions.length}`}
            </button>
          )}
        </div>
      )}

      {/* Archived Tab Action Bar */}
      {activeTab === "archived" && (
        <div className="mb-6 p-4 bg-red-50 border border-red-300 rounded-lg flex justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={handleSelectAllToggle}
                className="mr-2 h-5 w-5 text-casual-green rounded"
              />
              <span className="text-red-800 font-semibold text-sm">
                Select All ({displayedQuestions.length})
              </span>
            </label>
            <span className="text-red-700 font-semibold">
              {selectedArchivedQuestions.length} / {displayedQuestions.length}{" "}
              selected
            </span>
          </div>
          {selectedArchivedQuestions.length > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={bulkProcessing}
              className="bg-red-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {bulkProcessing
                ? "Processing..."
                : `🗑️ Delete ${selectedArchivedQuestions.length}`}
            </button>
          )}
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
                  : activeTab === "active"
                    ? () => toggleActiveQuestionSelection(question)
                    : activeTab === "archived"
                      ? () => toggleArchivedQuestionSelection(question)
                      : undefined
              }
              className={`transition-colors bg-white border-2 rounded-lg p-4 ${
                activeTab !== "active" && activeTab !== "archived"
                  ? "cursor-pointer"
                  : "cursor-pointer"
              }${
                (activeTab === "import" &&
                  selectedQuestions.some((q) => q.id === question.id)) ||
                (activeTab === "active" &&
                  selectedActiveQuestions.some((q) => q.id === question.id)) ||
                (activeTab === "archived" &&
                  selectedArchivedQuestions.some((q) => q.id === question.id))
                  ? " border-casual-green bg-green-50"
                  : " border-gray-200 hover:border-casual-green"
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  {/* Checkbox for all tabs */}
                  <input
                    type="checkbox"
                    checked={
                      activeTab === "import"
                        ? selectedQuestions.some((q) => q.id === question.id)
                        : activeTab === "active"
                          ? selectedActiveQuestions.some(
                              (q) => q.id === question.id,
                            )
                          : activeTab === "archived"
                            ? selectedArchivedQuestions.some(
                                (q) => q.id === question.id,
                              )
                            : false
                    }
                    onChange={(e) => {}}
                    className="mr-3 h-5 w-5 text-casual-green rounded pointer-events-none"
                  />

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

                  {/* True/False Answer Display */}
                  {question.type === "true_false" && (
                    <div className="mt-2 p-2 bg-green-50 border-l-4 border-green-600 rounded">
                      <p className="text-sm text-green-700">
                        <span className="font-semibold">Correct Answer:</span> {question.correct_answer} ✓
                      </p>
                    </div>
                  )}

                  {/* Other Types Answer Display */}
                  {question.type !== "mcq" && question.type !== "true_false" && question.correct_answer && (
                    <div className="mt-2 p-2 bg-green-50 border-l-4 border-green-600 rounded">
                      <p className="text-sm text-green-700">
                        <span className="font-semibold">Correct Answer:</span> {question.correct_answer} ✓
                      </p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 ml-4">
                  {activeTab === "active" && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          archiveQuestion(question.id);
                        }}
                        className="text-yellow-600 hover:text-yellow-800 text-sm font-semibold px-3 py-1"
                        title="Archive this question"
                      >
                        📁 Archive
                      </button>
                      {quizId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
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
                        onClick={(e) => {
                          e.stopPropagation();
                          restoreQuestion(question.id);
                        }}
                        className="text-green-600 hover:text-green-800 text-sm font-semibold px-3 py-1"
                        title="Restore this question"
                      >
                        ♻️ Restore
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const confirmed = await confirm({
                            title: "Delete Question Permanently",
                            message:
                              "Are you sure you want to permanently delete this question?",
                            confirmText: "Delete",
                            cancelText: "Cancel",
                            variant: "danger",
                          });
                          if (confirmed) {
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
