import { useState, useEffect } from "react";
import * as QuestionHook from "../../hooks/questionHook/questionHooks.js";
import { SearchInput } from "../../components/ui/inputs/SearchInput.jsx";
import { QuestionList } from "../../components/QuestionList.jsx";
import { AddEditForm } from "../../components/ui/forms/AddEditForm.jsx";

export const InstructorQuestions = () => {
  const { fetchQuestions, questions, loading } =
    QuestionHook.useFetchQuestion();
  const { filteredQuestions, searchTerm, setSearchTerm, setFilterType, setFilterFlag } =
    QuestionHook.useFilteredQuestion(questions);
  const {
    handleAddQuestion,
    handleSaveQuestion,
    setEditingId,
    setFormData,
    setShowForm,
    showForm,
  } = QuestionHook.useAddSaveQuestion();

  const [editingId, setEditingIdLocal] = useState(null);

  // Listen for questions-updated event
  useEffect(() => {
    const handleQuestionsUpdate = () => {
      fetchQuestions();
    };

    window.addEventListener("questions-updated", handleQuestionsUpdate);
    return () => window.removeEventListener("questions-updated", handleQuestionsUpdate);
  }, [fetchQuestions]);

  // Set editingId when editing a question
  const handleEditQuestion = (id) => {
    setEditingIdLocal(id);
    setEditingId(id);
  };

  // We need to get formData from the hook - let's use a simpler approach
  // Create a local state to hold form data for the form
  const [formData, setFormDataLocal] = useState({
    text: "",
    options: ["", ""],
    correctAnswer: 0,
    points: 1,
    flag: "pending",
    quiz_id: null,
  });

  // Wrap the setFormData to also update local state
  const handleSetFormData = (data) => {
    setFormDataLocal(data);
    setFormData(data);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand-gold"></div>
          <p className="mt-4 text-brand-navy font-semibold">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-authentic-white p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold text-brand-navy mb-2">
            Question Bank
          </h1>
          <p className="text-gray-600">
            Manage all your questions in one place
          </p>
        </div>
        <button
          onClick={handleAddQuestion}
          className="bg-brand-gold text-brand-navy px-6 py-3 rounded-lg font-semibold hover:bg-brand-gold-dark transition-colors"
        >
          + New Question
        </button>
      </div>

      {/* Filters */}
      <SearchInput
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        setFilterType={setFilterType}
        setFilterFlag={setFilterFlag}
      />

      {/* Add/Edit Form */}
      <AddEditForm
        handleSaveQuestion={handleSaveQuestion}
        formData={formData}
        setFormData={handleSetFormData}
        setShowForm={setShowForm}
        editingId={editingId}
      />

      {/* Questions List */}
      <QuestionList
        filteredQuestions={filteredQuestions}
        handleAddQuestion={handleAddQuestion}
        handleSaveQuestion={handleSaveQuestion}
        setFormData={handleSetFormData}
        setEditingId={handleEditQuestion}
        setShowForm={setShowForm}
      />
    </div>
  );
};
