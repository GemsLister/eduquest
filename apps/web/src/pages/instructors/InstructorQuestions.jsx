import * as QuestionHook from "../../hooks/questionHook/questionHooks.js";
import { SearchInput } from "../../components/ui/inputs/SearchInput.jsx";
import { QuestionList } from "../../components/QuestionList.jsx";
import { AddEditForm } from "../../components/ui/forms/AddEditForm.jsx";

export const InstructorQuestions = () => {
  const { fetchQuestions, questions, loading } =
    QuestionHook.useFetchQuestion();
  const { filteredQuestions, searchTerm, setSearchTerm, setFilterType } =
    QuestionHook.useFilteredQuestion(questions);
  const {
    handleAddQuestion,
    handleSaveQuestion,
    setEditingId,
    setFormData,
    setShowForm,
    showForm,
  } = QuestionHook.useAddSaveQuestion();

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
      {/* Search Input */}
      <SearchInput
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        setFilterType={setFilterType}
      />

      {/* Add/Edit Form */}
      <AddEditForm
        handleSaveQuestion={handleSaveQuestion}
        formData={formData}
        setFormData={setFormData}
        setShowForm={setShowForm}
      />

      {/* Questions List */}
      <QuestionList
        filteredQuestions={filteredQuestions}
        handleAddQuestion={handleAddQuestion}
        handleSaveQuestion={handleSaveQuestion}
        setFormData={setFormData}
        setShowForm={setShowForm}
        setEditingId={setEditingId}
      />
    </div>
  );
};