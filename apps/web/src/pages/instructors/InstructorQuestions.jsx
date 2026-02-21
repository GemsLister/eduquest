import * as QuestionHook from "../../hooks/questionHook/questionHooks.js";
import { SearchInput } from "../../components/ui/inputs/SearchInput.jsx";
import { QuestionList } from "../../components/QuestionList.jsx";

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
      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6 border-2 border-casual-green">
          <h2 className="text-xl font-bold text-hornblende-green mb-4">
            {editingId ? "Edit Question" : "Add New Question"}
          </h2>

          <div className="space-y-4">
            {/* Question Text */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Question Text *
              </label>
              <textarea
                value={formData.text}
                onChange={(e) =>
                  setFormData({ ...formData, text: e.target.value })
                }
                placeholder="Enter the question"
                rows="3"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-casual-green focus:ring-2 focus:ring-casual-green focus:ring-opacity-20"
              />
            </div>

            {/* Options for MCQ */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Options *
              </label>
              <div className="space-y-2">
                {formData.options.map((opt, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="radio"
                      name="correct"
                      checked={formData.correctAnswer === idx}
                      onChange={() =>
                        setFormData({
                          ...formData,
                          correctAnswer: idx,
                        })
                      }
                      className="mt-3"
                    />
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const newOptions = [...formData.options];
                        newOptions[idx] = e.target.value;
                        setFormData({ ...formData, options: newOptions });
                      }}
                      placeholder={`Option ${idx + 1}`}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-casual-green"
                    />
                    {formData.options.length > 2 && (
                      <button
                        onClick={() => {
                          const newOptions = formData.options.filter(
                            (_, i) => i !== idx,
                          );
                          setFormData({ ...formData, options: newOptions });
                        }}
                        className="text-red-500 hover:text-red-700 px-3 py-2"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={() =>
                  setFormData({
                    ...formData,
                    options: [...formData.options, ""],
                  })
                }
                className="text-sm text-casual-green font-semibold mt-2 hover:text-hornblende-green"
              >
                + Add Option
              </button>
            </div>

            {/* Points */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Points
              </label>
              <input
                type="number"
                value={formData.points}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    points: parseInt(e.target.value),
                  })
                }
                min="1"
                className="w-20 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-casual-green"
              />
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <button
              onClick={handleSaveQuestion}
              className="bg-casual-green text-white px-6 py-2 rounded-lg font-semibold hover:bg-hornblende-green transition-colors"
            >
              Save Question
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="bg-gray-300 text-gray-800 px-6 py-2 rounded-lg font-semibold hover:bg-gray-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Questions List */}
      <QuestionList
        filteredQuestions={filteredQuestions}
        handleAddQuestion={handleAddQuestion}
        handleSaveQuestion={handleSaveQuestion}
        setFormData={setFormData}
      />
    </div>
  );
};
