import { useState } from 'react';

export const CreateQuizFormButton = ({ onCreateQuiz }) => {
  const [showQuizForm, setShowQuizForm] = useState(false);
  const [quizFormData, setQuizFormData] = useState({ title: "", description: "" });

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreateQuiz(quizFormData); // Pass data back to parent
    setShowQuizForm(false);
    setQuizFormData({ title: "", description: "" });
  };

  return (
    <div>
      {!showQuizForm ? (
        <div className="mb-8">
          <button
            onClick={() => setShowQuizForm(true)}
            className="flex items-center gap-2 bg-casual-green text-white px-4 py-2 rounded-lg font-semibold hover:bg-hornblende-green transition-colors shadow-md"
          >
            <span className="text-lg">+</span> Create Quiz
          </button>
        </div>
      ) : (
        <div className="absolute bg-white rounded-lg p-6 shadow-md border border-casual-green mb-8 z-10">
          <h3 className="text-xl font-bold text-hornblende-green mb-4">Create New Quiz</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* ... Your existing input fields ... */}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowQuizForm(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-casual-green text-white rounded-lg font-semibold hover:bg-hornblende-green transition-colors"
              >
                Create Quiz
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};