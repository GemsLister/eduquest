export const AddEditForm = ({
  handleSaveQuestion,
  formData,
  setFormData,
  setShowForm,
  editingId,
  showForm,
}) => {
  return (
    <div>
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
                {formData.options && formData.options.map((opt, idx) => (
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
                    options: [...(formData.options || []), ""],
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

            {/* Flag/Status */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Status / Flag
              </label>
              <select
                value={formData.flag || "pending"}
                onChange={(e) =>
                  setFormData({ ...formData, flag: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-casual-green"
              >
                <option value="pending">Pending Review</option>
                <option value="retain">Retain (Good)</option>
                <option value="needs_revision">Needs Revision</option>
                <option value="discard">Discard</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Set the status to help track question quality. Questions with item analysis will be auto-flagged.
              </p>
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
    </div>
  );
};
