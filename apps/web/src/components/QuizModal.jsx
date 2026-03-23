import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { supabase } from "../supabaseClient.js";

export const QuizModal = ({ userId, sectionId = null, id = "quiz-modal" }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    const modal = document.getElementById(id);
    const handleClose = (e) => {
      if (e.target === modal || e.key === 'Escape') {
        modal.close();
      }
    };
    modal?.addEventListener('close', () => setTitle(''));
    document.addEventListener('keydown', handleClose);
    document.addEventListener('click', handleClose);

    return () => {
      document.removeEventListener('keydown', handleClose);
      document.removeEventListener('click', handleClose);
    };
  }, [id]);

  const handleCreateQuiz = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data: newQuiz, error } = await supabase
        .from("quizzes")
        .insert([{
          instructor_id: userId,
          section_id: sectionId || null,
          title: title.trim(),
          description: description.trim() || null,
          duration: duration ? parseInt(duration) : null,
        }])
        .select()
        .single();

      if (error) throw error;

      document.getElementById(id).close();
      setTitle('');
      setDescription('');
      setDuration('');
      toast.success(`Quiz "${newQuiz.title}" created successfully!`);
      navigate(`/instructor-dashboard/instructor-quiz/${newQuiz.id}`);
    } catch (err) {
      setError(err.message || "Failed to create quiz");
    } finally {
      setLoading(false);
    }
  };

  return (
    <dialog id={id} className="bg-transparent p-0 m-0 backdrop:bg-black/50">
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
          <div className="p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-hornblende-green">
                Create New Quiz
              </h2>
              <button
                onClick={() => document.getElementById(id).close()}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            {error && (
              <div className="mb-6 p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateQuiz}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Quiz Title *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Biology Midterm"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-casual-green focus:ring-2 focus:ring-casual-green/20"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional quiz instructions"
                    rows="3"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-casual-green focus:ring-2 focus:ring-casual-green/20 resize-vertical"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="Unlimited if blank"
                    min="1"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-casual-green focus:ring-2 focus:ring-casual-green/20"
                  />
                </div>
              </div>

              <div className="flex gap-4 mt-8">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-casual-green text-white py-3 px-6 rounded-lg font-semibold hover:bg-hornblende-green transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Creating..." : "Create Quiz"}
                </button>
                <button
                  type="button"
                  onClick={() => document.getElementById(id).close()}
                  disabled={loading}
                  className="flex-1 bg-gray-300 text-gray-800 py-3 px-6 rounded-lg font-semibold hover:bg-gray-400 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </dialog>
  );
};

