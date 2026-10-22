import React, { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient.js";
import { useQuestionBank } from "../hooks/questionHook/useQuestionBank.jsx";
import { analyzeGADQuestion } from "../services/gadAnalysisService.js";
import { useEscapeKey } from "../hooks/useEscapeKey.jsx";
import { useFocusTrap } from "../hooks/useFocusTrap.jsx";

/**
 * ImportQuestionBankModal
 * Lets instructors find questions in their Question Bank and add them to the quiz being edited.
 * - Add mode (no targetQuestionNumber): pick several questions, then add them all at once.
 * - Replace mode (targetQuestionNumber set): pick one question to replace that quiz question.
 */

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 250;

const TYPE_LABELS = {
  mcq: "MCQ",
  true_false: "T/F",
  identification: "Identification",
};

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "quiz", label: "Source exam (A–Z)" },
  { value: "points-high", label: "Points (high–low)" },
  { value: "points-low", label: "Points (low–high)" },
];

const normalize = (str) => String(str || "").toLowerCase().trim();

const getSubjectId = (q) =>
  q.subject_id || q.subjects?.id || q.quizzes?.subject_id || q.sections?.subject_id || null;

const getSubjectLabel = (subject) =>
  subject ? (subject.code ? `${subject.code} – ${subject.name}` : subject.name) : "";

// Convert a bank question into the shape the quiz editor works with
const toEditorQuestion = (bankQuestion) => {
  let correctAnswer = bankQuestion.correct_answer;
  if (bankQuestion.type === "mcq" && Array.isArray(bankQuestion.options)) {
    const matchedIdx = bankQuestion.options.indexOf(bankQuestion.correct_answer);
    correctAnswer = matchedIdx !== -1 ? matchedIdx : 0;
  } else if (bankQuestion.type === "true_false") {
    correctAnswer = String(bankQuestion.correct_answer).toLowerCase() === "true" ? 0 : 1;
  }

  return {
    text: bankQuestion.text || "",
    type: bankQuestion.type || "mcq",
    options: Array.isArray(bankQuestion.options) ? [...bankQuestion.options] : ["", "", "", ""],
    correctAnswer,
    points: bankQuestion.points || 1,
  };
};

const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const ChevronIcon = ({ open }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

export const ImportQuestionBankModal = ({
  isOpen,
  onClose,
  onSelectQuestion,
  onSelectQuestions,
  targetQuestionNumber = null,
  currentSubjectIds = [],
  currentQuizQuestions = [],
}) => {
  const { activeQuestions, loading } = useQuestionBank();
  const navigate = useNavigate();
  const location = useLocation();
  const questionBankPath = location.pathname.startsWith("/admin-dashboard")
    ? "/admin-dashboard/question-bank"
    : "/instructor-dashboard/question-bank";
  const isReplaceMode = targetQuestionNumber !== null;
  const hasQuizSubject = currentSubjectIds.length > 0;

  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [subjectFilter, setSubjectFilter] = useState(hasQuizSubject ? "quiz" : "all");
  const [sourceFilter, setSourceFilter] = useState("all"); // "all" | "mine" | "shared"
  const [typeFilter, setTypeFilter] = useState("all");
  const [gadOnly, setGadOnly] = useState(false);
  const [hideInQuiz, setHideInQuiz] = useState(true);
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [selected, setSelected] = useState(() => new Map());
  const [quizSubjects, setQuizSubjects] = useState([]);

  useEscapeKey(onClose, isOpen);
  const trapRef = useFocusTrap(isOpen);

  // Start fresh every time the modal opens
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setSelected(new Map());
      setExpandedIds(new Set());
      setSearchInput("");
      setSearchTerm("");
      setSubjectFilter(hasQuizSubject ? "quiz" : "all");
      setPage(1);
    }
  }

  // Debounce typing so filtering doesn't run on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Real subject names for the quiz's subjects (sections don't carry them)
  const subjectIdsKey = currentSubjectIds.map(String).sort().join(",");
  useEffect(() => {
    if (!isOpen || !subjectIdsKey) return;
    let cancelled = false;
    supabase
      .from("subjects")
      .select("id, name, code")
      .in("id", subjectIdsKey.split(","))
      .then(({ data }) => {
        if (!cancelled) setQuizSubjects(data || []);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, subjectIdsKey]);

  // GAD analysis is expensive, so run it once per question
  const gadById = useMemo(() => {
    const map = new Map();
    activeQuestions.forEach((q) => {
      if (q.is_gad === true) {
        map.set(q.id, { isGad: true, reason: "Marked as a GAD question" });
      } else {
        const auto = analyzeGADQuestion(q.text || "", q.options || []);
        map.set(q.id, { isGad: Boolean(auto.isGad), reason: auto.matchReason || "" });
      }
    });
    return map;
  }, [activeQuestions]);

  const quizTexts = useMemo(
    () => new Set(currentQuizQuestions.map((cq) => normalize(cq.text)).filter(Boolean)),
    [currentQuizQuestions],
  );
  const quizQuestionIds = useMemo(
    () => new Set(currentQuizQuestions.map((cq) => String(cq.id))),
    [currentQuizQuestions],
  );
  const isInQuiz = (q) =>
    !isReplaceMode && (quizQuestionIds.has(String(q.id)) || quizTexts.has(normalize(q.text)));

  // Subject dropdown options built from the bank plus the quiz's own subjects
  const subjectOptions = useMemo(() => {
    const map = new Map();
    quizSubjects.forEach((s) => map.set(String(s.id), s));
    activeQuestions.forEach((q) => {
      const id = getSubjectId(q);
      if (id && q.subjects?.name && !map.has(String(id))) {
        map.set(String(id), { id, name: q.subjects.name, code: q.subjects.code });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [activeQuestions, quizSubjects]);

  const quizSubjectIdSet = useMemo(() => new Set(currentSubjectIds.map(String)), [currentSubjectIds]);
  const hasUnassigned = activeQuestions.some((q) => !getSubjectId(q));

  const filtered = useMemo(() => {
    const term = normalize(searchTerm);
    const list = activeQuestions.filter((q) => {
      const subjectId = getSubjectId(q);
      if (subjectFilter === "quiz" && !quizSubjectIdSet.has(String(subjectId))) return false;
      if (subjectFilter === "none" && subjectId) return false;
      if (!["all", "quiz", "none"].includes(subjectFilter) && String(subjectId) !== subjectFilter) return false;

      if (sourceFilter === "mine" && !q.is_own) return false;
      if (sourceFilter === "shared" && q.is_own) return false;
      if (typeFilter !== "all" && (q.type || "mcq") !== typeFilter) return false;
      if (gadOnly && !gadById.get(q.id)?.isGad) return false;
      if (hideInQuiz && isInQuiz(q)) return false;

      if (term) {
        const haystack = [
          q.text,
          ...(Array.isArray(q.options) ? q.options : []),
          q.quizzes?.title,
          q.subjects?.name,
          q.subjects?.code,
          q.creator_name,
        ]
          .map(normalize)
          .join(" ");
        if (!haystack.includes(term)) return false;
      }
      return true;
    });

    return list.sort((a, b) => {
      switch (sortBy) {
        case "oldest":
          return new Date(a.created_at || 0) - new Date(b.created_at || 0);
        case "quiz":
          return (a.quizzes?.title || "~").localeCompare(b.quizzes?.title || "~");
        case "points-high":
          return (b.points || 1) - (a.points || 1);
        case "points-low":
          return (a.points || 1) - (b.points || 1);
        default:
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      }
    });
    // isInQuiz only depends on the memoized sets listed here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQuestions, searchTerm, subjectFilter, sourceFilter, typeFilter, gadOnly, hideInQuiz, sortBy, gadById, quizSubjectIdSet, quizTexts, quizQuestionIds, isReplaceMode]);

  // Back to page 1 whenever the result set changes shape
  const filterKey = [searchTerm, subjectFilter, sourceFilter, typeFilter, gadOnly, hideInQuiz, sortBy].join("|");
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (lastFilterKey !== filterKey) {
    setLastFilterKey(filterKey);
    setPage(1);
  }

  if (!isOpen) return null;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(pageStart, pageStart + PAGE_SIZE);
  const pageSelectableItems = pageItems.filter((q) => !isInQuiz(q));
  const allPageSelected =
    pageSelectableItems.length > 0 && pageSelectableItems.every((q) => selected.has(q.id));

  const quizSubjectLabel =
    quizSubjects.length > 0 ? quizSubjects.map(getSubjectLabel).join(", ") : "This exam's subject";

  const toggleExpanded = (id) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleSelected = (q) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(q.id)) next.delete(q.id);
      else next.set(q.id, q);
      return next;
    });

  const togglePageSelection = () =>
    setSelected((prev) => {
      const next = new Map(prev);
      pageSelectableItems.forEach((q) => {
        if (allPageSelected) next.delete(q.id);
        else next.set(q.id, q);
      });
      return next;
    });

  const handleAddSelected = () => {
    if (selected.size === 0) return;
    onSelectQuestions(Array.from(selected.values()).map(toEditorQuestion));
    onClose();
  };

  const handleReplaceWith = (q) => {
    onSelectQuestion(toEditorQuestion(q));
    onClose();
  };

  const clearFilters = () => {
    setSearchInput("");
    setSearchTerm("");
    setSubjectFilter("all");
    setSourceFilter("all");
    setTypeFilter("all");
    setGadOnly(false);
    setHideInQuiz(true);
  };

  const filtersActive =
    searchTerm || subjectFilter !== (hasQuizSubject ? "quiz" : "all") || sourceFilter !== "all" || typeFilter !== "all" || gadOnly;

  const selectClass =
    "px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 transition-all";

  const pillClass = (active) =>
    `px-3 py-1.5 rounded-lg text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 ${
      active
        ? "bg-brand-navy text-white shadow-xs"
        : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
    }`;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={onClose} />

      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bank-import-title"
        className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden z-10"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-navy to-brand-indigo text-white px-5 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-gold block mb-0.5">
              Question Bank
            </span>
            <h3 id="bank-import-title" className="text-lg font-bold flex items-center gap-2 flex-wrap">
              {isReplaceMode ? "Replace a question" : "Add questions to this exam"}
              {isReplaceMode && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand-gold text-brand-navy font-bold">
                  Question #{targetQuestionNumber}
                </span>
              )}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close question bank"
            className="w-8 h-8 shrink-0 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filters */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <label htmlFor="bank-search" className="sr-only">
                Search questions
              </label>
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <SearchIcon />
              </span>
              <input
                id="bank-search"
                type="search"
                placeholder="Search text, options, exam title, subject, or owner…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-brand-navy placeholder:text-slate-400 focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 transition-all"
              />
            </div>
            <label htmlFor="bank-subject" className="sr-only">
              Subject
            </label>
            <select
              id="bank-subject"
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className={`${selectClass} sm:w-56`}
            >
              {hasQuizSubject && <option value="quiz">{quizSubjectLabel}</option>}
              <option value="all">All subjects</option>
              {subjectOptions
                .filter((s) => !(hasQuizSubject && quizSubjectIdSet.has(String(s.id)) && quizSubjectIdSet.size === 1))
                .map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {getSubjectLabel(s)}
                  </option>
                ))}
              {hasUnassigned && <option value="none">No subject assigned</option>}
            </select>
            <label htmlFor="bank-sort" className="sr-only">
              Sort by
            </label>
            <select id="bank-sort" value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={`${selectClass} sm:w-44`}>
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Question source" className="flex gap-1.5">
              {[
                ["all", "All"],
                ["mine", "Mine"],
                ["shared", "Shared by others"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={sourceFilter === value}
                  onClick={() => setSourceFilter(value)}
                  className={pillClass(sourceFilter === value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <label htmlFor="bank-type" className="sr-only">
              Question type
            </label>
            <select id="bank-type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={selectClass}>
              <option value="all">All types</option>
              <option value="mcq">Multiple choice</option>
              <option value="true_false">True / False</option>
              <option value="identification">Identification</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer px-1">
              <input type="checkbox" checked={gadOnly} onChange={(e) => setGadOnly(e.target.checked)} className="h-4 w-4 rounded" />
              GAD only
            </label>
            {!isReplaceMode && (
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer px-1">
                <input type="checkbox" checked={hideInQuiz} onChange={(e) => setHideInQuiz(e.target.checked)} className="h-4 w-4 rounded" />
                Hide questions already in this exam
              </label>
            )}
            {filtersActive && (
              <button
                type="button"
                onClick={clearFilters}
                className="ml-auto text-xs font-bold text-brand-navy underline hover:text-brand-gold-dark rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto" aria-live="polite" aria-busy={loading}>
          {loading ? (
            <div className="divide-y divide-slate-100" aria-label="Loading question bank">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="px-5 py-3.5 flex items-center gap-3">
                  <div className="animate-pulse h-4 w-4 rounded bg-slate-200" />
                  <div className="flex-1 space-y-2">
                    <div className="animate-pulse h-3.5 w-2/3 rounded bg-slate-200" />
                    <div className="animate-pulse h-3 w-1/3 rounded bg-slate-200" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-14 px-6">
              <p className="text-sm font-bold text-slate-700">No questions match these filters</p>
              <p className="text-xs text-slate-500 mt-1">
                {subjectFilter === "quiz"
                  ? "Nothing in the bank is tagged with this exam's subject yet."
                  : "Try a different search or loosen the filters."}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {subjectFilter !== "all" && (
                  <button
                    type="button"
                    onClick={() => setSubjectFilter("all")}
                    className="px-4 py-2 bg-brand-navy text-white text-xs font-bold rounded-lg hover:bg-brand-navy/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
                  >
                    Search all subjects
                  </button>
                )}
                {filtersActive && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {!isReplaceMode && (
                <div className="px-5 py-2 border-b border-slate-100 bg-white sticky top-0 z-10 flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={togglePageSelection}
                      disabled={pageSelectableItems.length === 0}
                      className="h-4 w-4 rounded"
                    />
                    Select all on this page
                  </label>
                  {selected.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelected(new Map())}
                      className="text-xs font-bold text-slate-500 hover:text-brand-navy underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
                    >
                      Clear selection ({selected.size})
                    </button>
                  )}
                </div>
              )}

              <ul className="divide-y divide-slate-100">
                {pageItems.map((q) => {
                  const inQuiz = isInQuiz(q);
                  const isSelected = selected.has(q.id);
                  const isExpanded = expandedIds.has(q.id);
                  const gad = gadById.get(q.id);
                  const checkboxId = `bank-q-${q.id}`;
                  const meta = [
                    TYPE_LABELS[q.type] || q.type || "MCQ",
                    `${q.points || 1} pt${(q.points || 1) > 1 ? "s" : ""}`,
                    q.quizzes?.title ? `Exam: ${q.quizzes.title}` : "Standalone",
                    q.subjects?.name ? getSubjectLabel(q.subjects) : null,
                    q.is_own ? "Mine" : `Shared by ${q.creator_name || "Unknown instructor"}`,
                  ].filter(Boolean);

                  return (
                    <li
                      key={q.id}
                      className={`px-5 py-3 transition-colors ${
                        isSelected ? "bg-brand-gold/10" : inQuiz ? "bg-slate-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {!isReplaceMode && (
                          <input
                            id={checkboxId}
                            type="checkbox"
                            checked={isSelected}
                            disabled={inQuiz}
                            onChange={() => toggleSelected(q)}
                            className="mt-0.5 h-4 w-4 rounded cursor-pointer disabled:cursor-not-allowed"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <label
                            htmlFor={isReplaceMode ? undefined : checkboxId}
                            className={`block text-sm font-semibold leading-snug ${
                              inQuiz ? "text-slate-400" : "text-slate-900"
                            } ${isReplaceMode || inQuiz ? "" : "cursor-pointer"}`}
                          >
                            {q.text}
                          </label>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                            {meta.map((m, i) => (
                              <span key={i} className="flex items-center gap-2">
                                {i > 0 && <span aria-hidden="true">·</span>}
                                {m}
                              </span>
                            ))}
                            {gad?.isGad && (
                              <span
                                title={gad.reason || "Gender & Development (GAD) question"}
                                className="px-1.5 py-0.5 rounded bg-brand-navy/10 text-brand-navy font-bold"
                              >
                                GAD
                              </span>
                            )}
                            {inQuiz && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                                Already in exam
                              </span>
                            )}
                          </div>

                          {isExpanded && (
                            <div className="mt-2.5">
                              {Array.isArray(q.options) && q.options.length > 0 ? (
                                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                                  {q.options.map((opt, optIdx) => {
                                    const isCorrect =
                                      String(opt).trim() === String(q.correct_answer).trim() ||
                                      optIdx === q.correct_answer;
                                    return (
                                      <li
                                        key={optIdx}
                                        className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between gap-2 ${
                                          isCorrect
                                            ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold"
                                            : "bg-white border-slate-200 text-slate-700"
                                        }`}
                                      >
                                        <span>
                                          {String.fromCharCode(65 + optIdx)}. {opt}
                                        </span>
                                        {isCorrect && (
                                          <span className="text-[10px] font-bold text-emerald-700">Correct</span>
                                        )}
                                      </li>
                                    );
                                  })}
                                </ul>
                              ) : (
                                <p className="text-xs text-slate-600">
                                  Answer: <span className="font-semibold">{String(q.correct_answer ?? "—")}</span>
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleExpanded(q.id)}
                            aria-expanded={isExpanded}
                            aria-label={isExpanded ? "Hide answer choices" : "Show answer choices"}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 hover:text-brand-navy transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
                          >
                            <ChevronIcon open={isExpanded} />
                          </button>
                          {isReplaceMode && (
                            <button
                              type="button"
                              onClick={() => handleReplaceWith(q)}
                              className="px-3 py-1.5 bg-brand-gold hover:bg-brand-gold-dark text-brand-navy text-xs font-bold rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
                            >
                              Use this
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>
              {filtered.length === 0
                ? "0 questions"
                : `Showing ${pageStart + 1}–${Math.min(pageStart + PAGE_SIZE, filtered.length)} of ${filtered.length}`}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  aria-label="Previous page"
                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
                >
                  Prev
                </button>
                <span className="px-1.5 font-semibold text-slate-700" aria-live="polite">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  aria-label="Next page"
                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
                >
                  Next
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate(questionBankPath);
              }}
              title="Open the full Question Bank to edit, archive, or organize questions"
              className="px-2 py-2 text-xs font-bold text-brand-navy underline hover:text-brand-gold-dark rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
            >
              Manage Question Bank
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-sm font-semibold rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
            >
              Cancel
            </button>
            {!isReplaceMode && (
              <button
                type="button"
                onClick={handleAddSelected}
                disabled={selected.size === 0}
                className="px-4 py-2 bg-brand-gold hover:bg-brand-gold-dark text-brand-navy text-sm font-bold rounded-lg shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
              >
                {selected.size === 0
                  ? "Select questions to add"
                  : `Add ${selected.size} question${selected.size > 1 ? "s" : ""}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
