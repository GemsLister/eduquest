export const QuestionList = ({
  filteredQuestions,
  handleAddQuestion,
  setFormData,
}) => {
  return (
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
                    <span className="text-sm text-gray-500">
                      {question.points} points
                    </span>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
