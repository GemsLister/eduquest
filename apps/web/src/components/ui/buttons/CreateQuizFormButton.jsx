import { useState } from "react";

export const CreateQuizFormButton = ({
  onCreateQuiz,
  isSubmitting,
  quizFormData,
  setQuizFormData,
}) => {
  const [showQuizForm, setShowQuizForm] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreateQuiz(e);
    setShowQuizForm(false);
  };

  return (
    <>
      <button
        onClick={() => setShowQuizForm(true)}
        className="flex items-center gap-2 bg-brand-gold text-brand-navy px-4 py-2 rounded-lg font-semibold hover:bg-brand-gold-dark transition-colors shadow-md"
      >
        <span className="text-lg">+</span> Create Quiz
      </button>

      {showQuizForm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowQuizForm(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Green gradient header */}
            <div className="bg-gradient-to-r from-brand-navy to-brand-indigo px-6 py-5">
              <h3 className="text-xl font-bold text-white">Create New Quiz</h3>
              <p className="text-white/70 text-sm mt-1">
                Set up your quiz details before adding questions.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Quiz Title *
                </label>
                <input
                  type="text"
                  value={quizFormData.title}
                  onChange={(e) =>
                    setQuizFormData({ ...quizFormData, title: e.target.value })
                  }
                  placeholder="e.g., Biology Chapter 5 Test"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold text-sm"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={quizFormData.description}
                  onChange={(e) =>
                    setQuizFormData({
                      ...quizFormData,
                      description: e.target.value,
                    })
                  }
                  placeholder="Brief description of the quiz topic or instructions"
                  rows="3"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold text-sm resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  value={quizFormData.duration || ""}
                  onChange={(e) =>
                    setQuizFormData({
                      ...quizFormData,
                      duration: e.target.value,
                    })
                  }
                  placeholder="Leave blank for unlimited time"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold text-sm"
                />
              </div>

              {/* Info box */}
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <p className="text-xs text-green-700">
                  You can always edit these details later in the quiz editor.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuizForm(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2.5 bg-brand-gold text-brand-navy rounded-lg font-semibold text-sm hover:bg-brand-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Creating..." : "Create Quiz"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
