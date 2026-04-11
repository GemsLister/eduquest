import { useState } from "react";

export const CreateQuizFormButton = ({
  onCreateQuiz,
  isSubmitting,
  quizFormData,
  setQuizFormData,
  availableSections,
}) => {
  const [showQuizForm, setShowQuizForm] = useState(false);

  const selectedIds = quizFormData.section_ids || [];

  const toggleSection = (id) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((s) => s !== id)
      : [...selectedIds, id];
    setQuizFormData({ ...quizFormData, section_ids: next });
  };

  const toggleAll = () => {
    if (selectedIds.length === availableSections.length) {
      setQuizFormData({ ...quizFormData, section_ids: [] });
    } else {
      setQuizFormData({
        ...quizFormData,
        section_ids: availableSections.map((s) => s.id),
      });
    }
  };

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
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-brand-navy to-brand-indigo px-6 py-5 shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold text-white">
                    Create New Quiz
                  </h3>
                  <p className="text-white/70 text-sm mt-1">
                    Set up your quiz details before adding questions.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowQuizForm(false)}
                  aria-label="Close create quiz form"
                  className="text-white/80 hover:text-white text-2xl leading-none font-semibold transition-colors"
                >
                  ×
                </button>
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="p-6 space-y-4 overflow-y-auto"
            >
              {/* Subject / Section multi-select */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Assign to Subject(s) <span className="text-red-500">*</span>
                </label>
                {availableSections && availableSections.length > 0 ? (
                  <div className="border border-gray-300 rounded-lg overflow-hidden">
                    {/* Select All header */}
                    <label className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={
                          selectedIds.length === availableSections.length
                        }
                        onChange={toggleAll}
                        className="form-checkbox h-4 w-4 text-brand-navy border-gray-300 rounded"
                      />
                      <span className="text-sm font-semibold text-gray-700">
                        Select All
                      </span>
                      <span className="ml-auto text-xs text-gray-400">
                        {selectedIds.length}/{availableSections.length}
                      </span>
                    </label>

                    {/* Section list */}
                    <div className="max-h-40 overflow-y-auto divide-y divide-gray-100">
                      {availableSections.map((sec) => (
                        <label
                          key={sec.id}
                          className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                            selectedIds.includes(sec.id)
                              ? "bg-brand-gold/5"
                              : "hover:bg-gray-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(sec.id)}
                            onChange={() => toggleSection(sec.id)}
                            className="form-checkbox h-4 w-4 text-brand-navy border-gray-300 rounded"
                          />
                          <div className="min-w-0">
                            <span className="block text-sm font-medium text-gray-800 truncate">
                              {sec.name}
                              {sec.subject_code ? (
                                <span className="text-gray-400 font-normal">
                                  {" "}
                                  ({sec.subject_code})
                                </span>
                              ) : null}
                            </span>
                            {sec.description && (
                              <span className="block text-xs text-gray-500 truncate">
                                {sec.description}
                              </span>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-xs text-yellow-700">
                      No subjects found. Please create a subject first from the
                      dashboard before creating a quiz.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Quiz Title <span className="text-red-500">*</span>
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
                  Instructions
                </label>
                <textarea
                  value={quizFormData.description}
                  onChange={(e) =>
                    setQuizFormData({
                      ...quizFormData,
                      description: e.target.value,
                    })
                  }
                  placeholder="Instructions of the quiz"
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
                  disabled={
                    isSubmitting ||
                    !availableSections ||
                    availableSections.length === 0 ||
                    selectedIds.length === 0
                  }
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
