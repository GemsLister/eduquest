import { useState, useEffect } from "react";
import { supabase } from "../../../supabaseClient";
import { useAuth } from "../../../context/AuthContext";

export const AddEditForm = ({
  handleSaveQuestion,
  formData,
  setFormData,
  setShowForm,
  editingId
}) => {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [loadingQuizzes, setLoadingQuizzes] = useState(true);

  // Fetch quizzes for selection when adding new question
  useEffect(() => {
    const fetchQuizzes = async () => {
      if (!editingId) {
        // Only fetch quizzes when adding new question
        try {
          if (user) {
            const { data, error } = await supabase
              .from("quizzes")
              .select("id, title")
              .eq("instructor_id", user.id)
              .order("title", { ascending: true });
            
            if (!error) {
              setQuizzes(data || []);
            }
          }
        } catch (error) {
          console.error("Error fetching quizzes:", error);
        }
      }
      setLoadingQuizzes(false);
    };

    fetchQuizzes();
  }, [editingId]);

  return (
    <div>
      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6 border-2 border-brand-gold">
          <h2 className="text-xl font-bold text-brand-navy mb-4">
            {editingId ? "Edit Question" : "Add New Question"}
          </h2>

          {/* Quiz Selection - Only show when adding new question */}
          {!editingId && (
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select Quiz *
              </label>
              <select
                value={formData.quiz_id || ""}
                onChange={(e) =>
                  setFormData({ ...formData, quiz_id: e.target.value })
                }
                disabled={loadingQuizzes}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold focus:ring-opacity-20 bg-white"
              >
                <option value="">
                  {loadingQuizzes ? "Loading quizzes..." : "-- Select a Quiz --"}
                </option>
                {quizzes.map((quiz) => (
                  <option key={quiz.id} value={quiz.id}>
                    {quiz.title}
                  </option>
                ))}
              </select>
            </div>
          )}

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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold focus:ring-opacity-20"
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
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-gold"
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
                className="text-sm text-brand-gold-dark font-semibold mt-2 hover:text-brand-navy"
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
                className="w-20 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-gold"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold focus:ring-opacity-20 bg-white"
              >
                <option value="pending">Pending Review</option>
                <option value="approved">Approved</option>
                <option value="needs_revision">Needs Revision</option>
                <option value="discard">Discard</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Set the status to help track question quality. 
                Use "Approved" for good questions, "Needs Revision" for questions that need improvement, 
                and "Discard" for questions to remove.
              </p>
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <button
              onClick={handleSaveQuestion}
              className="bg-brand-gold text-brand-navy px-6 py-2 rounded-lg font-semibold hover:bg-brand-gold-dark transition-colors"
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
