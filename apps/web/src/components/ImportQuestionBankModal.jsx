import React, { useState } from "react";
import { useQuestionBank } from "../hooks/questionHook/useQuestionBank.jsx";
import { useAuth } from "../context/AuthContext.jsx";

/**
 * ImportQuestionBankModal
 * Allows instructors to select a question from their Question Bank to import into a specific question number in a quiz.
 * Strictly enforces subject filtering so only questions belonging to the same subject are shown.
 * Displays clear badges and filters for questions created from private quizzes/questions.
 */
export const ImportQuestionBankModal = ({
  isOpen,
  onClose,
  onSelectQuestion,
  targetQuestionNumber = null,
  currentSubjectIds = [],
  currentSubjectNames = [],
}) => {
  const { activeQuestions, loading } = useQuestionBank();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState("all");
  const [privacyFilter, setPrivacyFilter] = useState("all"); // "all", "my_private", "my_public", "others_public"

  if (!isOpen) return null;

  const normalize = (str) => String(str || "").toLowerCase().trim();
  const normalizedSubjectNames = (currentSubjectNames || []).map(normalize).filter(Boolean);

  // 1. Strict Subject Filter: Filter bank questions to ONLY those matching the current quiz's subject
  const subjectMatchedQuestions = activeQuestions.filter((q) => {
    // If no subject is assigned to current quiz yet, allow viewing user's bank questions
    if ((!currentSubjectIds || currentSubjectIds.length === 0) && normalizedSubjectNames.length === 0) {
      return true;
    }

    const qSubjectId = q.subject_id || q.quizzes?.subject_id || q.sections?.subject_id;
    const qSubjectName = normalize(
      q.subject_name || q.subjects?.name || q.quizzes?.subjects?.name || q.sections?.subject_name || q.quizzes?.subject_code
    );

    // Check ID match
    if (qSubjectId && currentSubjectIds.some(id => String(id) === String(qSubjectId))) {
      return true;
    }

    // Check Name match
    if (qSubjectName && normalizedSubjectNames.some((name) => qSubjectName.includes(name) || name.includes(qSubjectName))) {
      return true;
    }

    return false;
  });

  // Helper function to check if a question is owned by current instructor
  const isQuestionOwn = (q) => {
    return q.is_own || (q.quizzes && q.quizzes.instructor_id === user?.id);
  };

  // Helper function to check if a question is private
  const isQuestionPrivate = (q) => {
    if (q.is_private === true) return true;
    if (q.quizzes && q.quizzes.is_private !== false) return true;
    return false;
  };

  // Counts for tabs
  const myPrivateCount = subjectMatchedQuestions.filter(q => isQuestionOwn(q) && isQuestionPrivate(q)).length;
  const myPublicCount = subjectMatchedQuestions.filter(q => isQuestionOwn(q) && !isQuestionPrivate(q)).length;
  const sharedCount = subjectMatchedQuestions.filter(q => !isQuestionOwn(q)).length;

  // 2. Privacy & Ownership Filtering
  const privacyFilteredQuestions = subjectMatchedQuestions.filter((q) => {
    const isOwn = isQuestionOwn(q);
    const isPrivate = isQuestionPrivate(q);

    if (privacyFilter === "my_private") {
      return isOwn && isPrivate;
    }
    if (privacyFilter === "my_public") {
      return isOwn && !isPrivate;
    }
    if (privacyFilter === "others_public") {
      return !isOwn;
    }
    return true;
  });

  // 3. Search Term & Dropdown Subject Filter
  const finalFilteredQuestions = privacyFilteredQuestions.filter((q) => {
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const textMatch = (q.text || "").toLowerCase().includes(term);
      const optionsMatch = Array.isArray(q.options)
        ? q.options.some((opt) => (opt || "").toLowerCase().includes(term))
        : false;
      if (!textMatch && !optionsMatch) return false;
    }
    if (selectedSubjectFilter !== "all") {
      const subjectName = q.quizzes?.subjects?.name || q.subjects?.name || q.subject_name;
      if (subjectName !== selectedSubjectFilter) return false;
    }
    return true;
  });

  // Extract unique subjects within the matched subject scope
  const subjectsList = [
    ...new Set(
      subjectMatchedQuestions
        .map((q) => q.quizzes?.subjects?.name || q.subjects?.name || q.subject_name)
        .filter(Boolean)
    ),
  ];

  const handleChoose = (bankQuestion) => {
    // Format correct answer index or value
    let formattedCorrectAnswer = bankQuestion.correct_answer;
    if (bankQuestion.type === "mcq" && Array.isArray(bankQuestion.options)) {
      const matchedIdx = bankQuestion.options.indexOf(bankQuestion.correct_answer);
      formattedCorrectAnswer = matchedIdx !== -1 ? matchedIdx : 0;
    } else if (bankQuestion.type === "true_false") {
      formattedCorrectAnswer = String(bankQuestion.correct_answer).toLowerCase() === "true" ? 0 : 1;
    }

    onSelectQuestion({
      text: bankQuestion.text || "",
      type: bankQuestion.type || "mcq",
      options: Array.isArray(bankQuestion.options) ? [...bankQuestion.options] : ["", "", "", ""],
      correctAnswer: formattedCorrectAnswer,
      points: bankQuestion.points || 1,
    });

    onClose();
  };

  const activeSubjectTitle = currentSubjectNames.length > 0
    ? currentSubjectNames.join(", ")
    : "Unassigned Subject";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-10">
        {/* Header */}
        <div className="bg-brand-navy text-white p-5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-brand-gold block mb-0.5">
              Question Bank Import
            </span>
            <h3 className="text-lg font-black flex items-center gap-2 flex-wrap">
              <span>📚 Select Question from Question Bank</span>
              {targetQuestionNumber && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand-gold text-brand-navy font-extrabold">
                  For Question #{targetQuestionNumber}
                </span>
              )}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-base transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Subject Constraint Notice Bar */}
        <div className="bg-indigo-50 border-b border-indigo-200 px-5 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-extrabold text-indigo-900">
            <span>🔒 Subject Restricted:</span>
            <span className="px-2 py-0.5 bg-white border border-indigo-300 text-indigo-800 rounded-md shadow-2xs">
              {activeSubjectTitle}
            </span>
          </div>
          <span className="text-[11px] font-semibold text-indigo-700">
            Only showing questions from this subject
          </span>
        </div>

        {/* Privacy & Ownership Filter Buttons */}
        <div className="bg-slate-100/90 border-b border-slate-200 px-4 py-2.5 flex flex-wrap gap-2 items-center">
          <span className="text-xs font-black uppercase text-slate-500 tracking-wider mr-1">
            Filter:
          </span>
          <button
            onClick={() => setPrivacyFilter("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
              privacyFilter === "all"
                ? "bg-brand-navy text-white shadow-xs"
                : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
            }`}
          >
            <span>📚 All Questions</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              privacyFilter === "all" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-800"
            }`}>
              {subjectMatchedQuestions.length}
            </span>
          </button>

          <button
            onClick={() => setPrivacyFilter("my_private")}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
              privacyFilter === "my_private"
                ? "bg-amber-500 text-white shadow-xs"
                : "bg-amber-50 text-amber-950 border border-amber-300 hover:bg-amber-100"
            }`}
          >
            <span>🔒 Private Questions</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              privacyFilter === "my_private" ? "bg-white/20 text-white font-black" : "bg-amber-200 text-amber-950 font-black"
            }`}>
              {myPrivateCount}
            </span>
          </button>

          <button
            onClick={() => setPrivacyFilter("my_public")}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
              privacyFilter === "my_public"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-emerald-50 text-emerald-950 border border-emerald-300 hover:bg-emerald-100"
            }`}
          >
            <span>🌐 Public Questions</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              privacyFilter === "my_public" ? "bg-white/20 text-white font-black" : "bg-emerald-200 text-emerald-950 font-black"
            }`}>
              {myPublicCount}
            </span>
          </button>

          <button
            onClick={() => setPrivacyFilter("others_public")}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
              privacyFilter === "others_public"
                ? "bg-sky-600 text-white shadow-xs"
                : "bg-sky-50 text-sky-950 border border-sky-300 hover:bg-sky-100"
            }`}
          >
            <span>👥 Shared Questions</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              privacyFilter === "others_public" ? "bg-white/20 text-white font-black" : "bg-sky-200 text-sky-950 font-black"
            }`}>
              {sharedCount}
            </span>
          </button>
        </div>

        {/* Filters Row */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search question text or options..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
              🔍
            </span>
          </div>

          {subjectsList.length > 1 && (
            <div className="w-full sm:w-48">
              <select
                value={selectedSubjectFilter}
                onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-gold"
              >
                <option value="all">All Matched Sections</option>
                {subjectsList.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Content Stream */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-gold mb-2"></div>
              <span className="text-xs font-bold text-slate-500 uppercase">
                Loading Question Bank...
              </span>
            </div>
          ) : finalFilteredQuestions.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300 p-8">
              <span className="text-3xl mb-2 block">📚</span>
              <p className="text-sm font-bold text-slate-700">
                {privacyFilter === "my_private"
                  ? "No Private Questions Found for this Subject"
                  : `No Questions Found for Subject "${activeSubjectTitle}"`}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {privacyFilter === "my_private"
                  ? "You don't have any private questions created in this subject yet."
                  : "Try clearing search filters or selecting another category above."}
              </p>
            </div>
          ) : (
            finalFilteredQuestions.map((q, idx) => {
              const isOwn = isQuestionOwn(q);
              const isPrivate = isQuestionPrivate(q);

              return (
                <div
                  key={q.id || idx}
                  className={`bg-white border rounded-2xl p-4 shadow-xs transition-all space-y-3 ${
                    isOwn && isPrivate
                      ? "border-amber-300 hover:border-amber-500 bg-amber-50/20"
                      : "border-slate-200 hover:border-brand-navy/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        {/* Type badge */}
                        <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-md text-[10px] font-black uppercase text-slate-700">
                          {q.type === "mcq" ? "Multiple Choice" : q.type === "true_false" ? "True / False" : q.type}
                        </span>

                        {/* Points badge */}
                        <span className="px-2 py-0.5 bg-brand-navy/10 text-brand-navy rounded-md text-[10px] font-bold">
                          {q.points || 1} Pt{(q.points || 1) > 1 ? "s" : ""}
                        </span>

                        {/* Subject badge */}
                        {(q.quizzes?.subjects?.name || q.subjects?.name || q.subject_name) && (
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-[10px] font-bold">
                            📖 {q.quizzes?.subjects?.name || q.subjects?.name || q.subject_name}
                          </span>
                        )}

                        {/* Privacy & Ownership Badges */}
                        {isOwn && isPrivate && (
                          <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-md text-[10px] font-black flex items-center gap-1 shadow-2xs">
                            🔒 My Private Question
                          </span>
                        )}
                        {isOwn && !isPrivate && (
                          <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-md text-[10px] font-black flex items-center gap-1 shadow-2xs">
                            🌐 My Public Question
                          </span>
                        )}
                        {!isOwn && (
                          <span className="px-2.5 py-0.5 bg-sky-100 text-sky-900 border border-sky-300 rounded-md text-[10px] font-black flex items-center gap-1 shadow-2xs">
                            👥 Shared Question
                          </span>
                        )}

                        {/* Source Quiz Info */}
                        {q.quizzes?.title && (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-md text-[10px] font-semibold italic">
                            📝 Quiz: {q.quizzes.title}
                          </span>
                        )}

                        {/* Owner Name Tag */}
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold flex items-center gap-1 shadow-2xs bg-purple-100 text-purple-950 border border-purple-300">
                          👤 Owner: ({q.creator_name || user?.user_metadata?.full_name || "Instructor"})
                        </span>
                      </div>

                      <h4 className="text-sm font-extrabold text-slate-900 leading-snug">
                        {q.text}
                      </h4>
                    </div>

                    <button
                      onClick={() => handleChoose(q)}
                      className="px-4 py-2 bg-brand-gold hover:bg-brand-gold-dark text-brand-navy font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 flex-shrink-0"
                    >
                      <span>📥</span>
                      <span>Import This Question</span>
                    </button>
                  </div>

                  {/* Display MCQ Options Preview if available */}
                  {Array.isArray(q.options) && q.options.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                      {q.options.map((opt, optIdx) => {
                        const isCorrect =
                          String(opt).trim() === String(q.correct_answer).trim() ||
                          optIdx === q.correct_answer;
                        return (
                          <div
                            key={optIdx}
                            className={`p-2 rounded-lg border font-medium flex items-center justify-between ${
                              isCorrect
                                ? "bg-emerald-50 border-emerald-300 text-emerald-950 font-bold"
                                : "bg-white border-slate-200 text-slate-700"
                            }`}
                          >
                            <span>
                              {String.fromCharCode(65 + optIdx)}. {opt}
                            </span>
                            {isCorrect && (
                              <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-black">
                                Correct
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <span>
            Matched Questions: <strong>{finalFilteredQuestions.length}</strong> (Total Subject Bank: <strong>{subjectMatchedQuestions.length}</strong>)
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

