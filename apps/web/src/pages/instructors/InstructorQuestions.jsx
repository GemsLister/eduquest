import { useEffect } from "react";
import * as QuestionHook from "../../hooks/questionHook/questionHooks.js";
import { SearchInput } from "../../components/ui/inputs/SearchInput.jsx";
import { QuestionList } from "../../components/QuestionList.jsx";
import { AddEditForm } from "../../components/ui/forms/AddEditForm.jsx";

export const InstructorQuestions = () => {
  const { fetchQuestions, questions, loading } =
    QuestionHook.useFetchQuestion();
  const { filteredQuestions, searchTerm, setSearchTerm, setFilterType, filterFlag, setFilterFlag } =
    QuestionHook.useFilteredQuestion(questions);
  const {
    handleAddQuestion,
    handleSaveQuestion,
    setEditingId,
    setFormData,
    setShowForm,
    showForm,
    editingId,
    formData,
  } = QuestionHook.useAddSaveQuestion();
  const { handleDeleteQuestion } = QuestionHook.useDeleteQuestion();

  // Listen for questions-updated event to refetch
  useEffect(() => {
    const handleQuestionsUpdate = () => {
      fetchQuestions();
    };
    
    window.addEventListener('questions-updated', handleQuestionsUpdate);
    
    return () => {
      window.removeEventListener('questions-updated', handleQuestionsUpdate);
    };
  }, [fetchQuestions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-casual-green"></div>
          <p className="mt-4 text-hornblende-green font-semibold">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-authentic-white p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold text-hornblende-green mb-2">
            Question Bank
          </h1>
          <p className="text-gray-600">
            Manage all your questions in one place
          </p>
        </div>
        <button
          onClick={handleAddQuestion}
          className="bg-casual-green text-white px-6 py-3 rounded-lg font-semibold hover:bg-hornblende-green transition-colors"
        >
          + New Question
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <SearchInput
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          setFilterType={setFilterType}
        />
        
        {/* Flag Filter */}
        <select
          value={filterFlag}
          onChange={(e) => setFilterFlag(e.target.value)}
          className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-casual-green"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="retain">Retain (Good)</option>
          <option value="needs_revision">Needs Revision</option>
          <option value="discard">Discard</option>
        </select>
      </div>

      {/* Add/Edit Form */}
      <AddEditForm
        handleSaveQuestion={handleSaveQuestion}
        formData={formData}
        setFormData={setFormData}
        setShowForm={setShowForm}
        editingId={editingId}
        showForm={showForm}
      />

      {/* Questions List */}
      <QuestionList
        filteredQuestions={filteredQuestions}
        handleAddQuestion={handleAddQuestion}
        handleSaveQuestion={handleSaveQuestion}
        setFormData={setFormData}
        setShowForm={setShowForm}
        setEditingId={setEditingId}
        handleDeleteQuestion={handleDeleteQuestion}
      />
    </div>
  );
};
