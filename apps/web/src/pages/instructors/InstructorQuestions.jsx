import { useState } from "react";

const QUESTION_TYPES = {
  mcq: "Multiple Choice",
  short_answer: "Short Answer",
  true_false: "True/False",
};

export const InstructorQuestions = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");

  const filteredQuestions = questions.filter((q) => {
    const matchesSearch = q.text
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || q.type === filterType;
    return matchesSearch && matchesType;
  });


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
      <div className="bg-white rounded-lg shadow-md p-4 mb-6 flex gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search questions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-casual-green focus:ring-2 focus:ring-casual-green focus:ring-opacity-20"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-casual-green"
        >
          <option value="all">All Types</option>
          <option value="mcq">Multiple Choice</option>
          <option value="short_answer">Short Answer</option>
          <option value="true_false">True/False</option>
        </select>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6 border-2 border-casual-green">
          <h2 className="text-xl font-bold text-hornblende-green mb-4">
            {editingId ? "Edit Question" : "Add New Question"}
          </h2>

          <div className="space-y-4">
            {/* Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Question Type
              </label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-casual-green"
              >
                <option value="mcq">Multiple Choice</option>
                <option value="short_answer">Short Answer</option>
                <option value="true_false">True/False</option>
              </select>
            </div>

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
            {formData.type === "mcq" && (
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
            )}

            {/* True/False */}
            {formData.type === "true_false" && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Correct Answer *
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="tf"
                      checked={formData.correctAnswer === 0}
                      onChange={() =>
                        setFormData({ ...formData, correctAnswer: 0 })
                      }
                      className="mr-2"
                    />
                    <span>True</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="tf"
                      checked={formData.correctAnswer === 1}
                      onChange={() =>
                        setFormData({ ...formData, correctAnswer: 1 })
                      }
                      className="mr-2"
                    />
                    <span>False</span>
                  </label>
                </div>
              </div>
            )}

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
      <div className="bg-white rounded-lg shadow-md p-6">
        {filteredQuestions.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">❓</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              {questions.length === 0 ? "No Questions Yet" : "No Results"}
            </h3>
            <p className="text-gray-500 mb-4">
              {questions.length === 0
                ? "Create your first question to get started"
                : "Try adjusting your filters"}
            </p>
            {questions.length === 0 && (
              <button
                onClick={handleAddQuestion}
                className="bg-casual-green text-white px-6 py-2 rounded-lg font-semibold hover:bg-hornblende-green transition-colors"
              >
                Create Question
              </button>
            )}
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
                      <span className="inline-block bg-casual-green text-white text-xs font-bold px-3 py-1 rounded">
                        {QUESTION_TYPES[question.type]}
                      </span>
                      <span className="text-sm text-gray-500">
                        {question.points} points
                      </span>
                    </div>
                    <p className="text-gray-800 font-semibold">
                      {question.text}
                    </p>
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
                      onClick={() => handleDeleteQuestion(question.id)}
                      className="text-red-500 hover:text-red-700 font-semibold text-sm"
                    >
                      Delete
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

                {/* Show Answer for True/False */}
                {question.type === "true_false" && (
                  <div className="mt-3 ml-4 text-sm text-gray-600">
                    <p className="font-semibold">
                      Correct Answer:{" "}
                      <span className="text-casual-green font-bold">
                        {question.correctAnswer === 0 ? "True" : "False"}
                      </span>
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
