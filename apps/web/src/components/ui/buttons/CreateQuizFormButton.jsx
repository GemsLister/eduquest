import { useState } from "react";
import { CentralizedSubjectDropdown } from "../../CentralizedSubjectDropdown.jsx";

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
        <span className="text-lg">+</span> Create Assessment / Exam
      </button>

      {showQuizForm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowQuizForm(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-brand-navy to-brand-indigo px-6 py-5 shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold text-white">
                    Create New Assessment / Exam
                  </h3>
                  <p className="text-white/70 text-sm mt-1">
                    Select the term (Prelims, Midterms, or Final Term) and assign details.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowQuizForm(false)}
                  aria-label="Close form"
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
              {/* Assessment Term / Type Selector */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Assessment Term <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "Prelims", label: "Prelims", icon: "📝" },
                    { id: "Midterms", label: "Midterms", icon: "📘" },
                    { id: "Final Term", label: "Final Term", icon: "🎓" },
                  ].map((item) => {
                    const active = (quizFormData.term || "Prelims") === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          const newTerm = item.id;
                          let newTitle = quizFormData.title;
                          if (
                            !newTitle.trim() ||
                            ["Prelims Examination", "Midterms Examination", "Final Term Examination"].includes(newTitle.trim())
                          ) {
                            newTitle = `${item.label} Examination`;
                          }
                          setQuizFormData({
                            ...quizFormData,
                            term: newTerm,
                            title: newTitle,
                          });
                        }}
                        className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                          active
                            ? "bg-brand-navy text-white border-brand-navy shadow-sm ring-2 ring-brand-navy/20"
                            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

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
                      No sections found. Please create a section with an assigned subject first from the dashboard before creating an assessment.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Assessment Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={quizFormData.title}
                  onChange={(e) =>
                    setQuizFormData({ ...quizFormData, title: e.target.value })
                  }
                  placeholder="e.g., Midterms Examination - IT 101"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold text-sm"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Instructions / Description
                </label>
                <textarea
                  value={quizFormData.description}
                  onChange={(e) =>
                    setQuizFormData({
                      ...quizFormData,
                      description: e.target.value,
                    })
                  }
                  placeholder="Instructions for this assessment"
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

              {/* Visibility Setting */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Assessment Visibility &amp; Sharing
                </label>
                <div className="flex flex-col gap-2.5">
                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      (quizFormData.visibility || (quizFormData.is_private !== false ? "private" : "public")) === "private"
                        ? "border-brand-navy bg-brand-navy/5 ring-1 ring-brand-navy shadow-sm"
                        : "border-gray-200 bg-white hover:bg-gray-50/80 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="quiz_visibility"
                      checked={(quizFormData.visibility || (quizFormData.is_private !== false ? "private" : "public")) === "private"}
                      onChange={() =>
                        setQuizFormData({
                          ...quizFormData,
                          visibility: "private",
                          is_private: true,
                          is_shared: false,
                        })
                      }
                      className="mt-1 text-brand-navy focus:ring-brand-navy shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-gray-900 flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                          Private
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full border border-gray-200 shrink-0">Default</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                        Only you can see and manage this assessment.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      quizFormData.visibility === "shared" || quizFormData.is_shared
                        ? "border-brand-navy bg-brand-navy/5 ring-1 ring-brand-navy shadow-sm"
                        : "border-gray-200 bg-white hover:bg-gray-50/80 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="quiz_visibility"
                      checked={quizFormData.visibility === "shared" || Boolean(quizFormData.is_shared)}
                      onChange={() =>
                        setQuizFormData({
                          ...quizFormData,
                          visibility: "shared",
                          is_private: false,
                          is_shared: true,
                        })
                      }
                      className="mt-1 text-brand-navy focus:ring-brand-navy shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-gray-900 flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Shared
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                        Shared with instructors teaching the same subject or sections.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      quizFormData.visibility === "public" || (quizFormData.is_private === false && !quizFormData.is_shared)
                        ? "border-brand-navy bg-brand-navy/5 ring-1 ring-brand-navy shadow-sm"
                        : "border-gray-200 bg-white hover:bg-gray-50/80 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="quiz_visibility"
                      checked={quizFormData.visibility === "public" || (quizFormData.is_private === false && !quizFormData.is_shared)}
                      onChange={() =>
                        setQuizFormData({
                          ...quizFormData,
                          visibility: "public",
                          is_private: false,
                          is_shared: false,
                        })
                      }
                      className="mt-1 text-brand-navy focus:ring-brand-navy shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-gray-900 flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <circle cx="12" cy="12" r="10" />
                            <line x1="2" y1="12" x2="22" y2="12" />
                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                          </svg>
                          Public
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                        Visible to all instructors; questions added to Question Bank.
                      </p>
                    </div>
                  </label>
                </div>
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
