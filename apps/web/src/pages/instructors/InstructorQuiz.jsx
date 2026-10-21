import { useState, useEffect, useRef, useCallback } from "react";
import { useBlocker, useLocation, useNavigate, useParams } from "react-router-dom";
import { notify } from "../../utils/notify.jsx";
import { useConfirm } from "../../components/ui/ConfirmModal.jsx";
import { SelectSubjectModal } from "../../components/SelectSubjectModal.jsx";
import { supabase } from "../../supabaseClient.js";
import { QuizAnalysisResults } from "../../components/QuizAnalysisResults.jsx";
import { QuizRevisionHistory } from "../../components/container/quiz/QuizRevisionHistory.jsx";
import { logAudit } from "../../services/auditService.js";
import { ImportQuestionBankModal } from "../../components/ImportQuestionBankModal.jsx";
import { Skeleton } from "../../components/ui/Skeleton.jsx";
import { useEscapeKey } from "../../hooks/useEscapeKey.jsx";
import { analyzeGADQuestion, detectGenderBias, replaceGenderBiasedTerm } from "../../services/gadAnalysisService.js";
import { useFocusTrap } from "../../hooks/useFocusTrap.jsx";

// Review states during which the quiz content must not change
const REVIEW_LOCKED_STATUSES = ["pending", "faculty_head_review", "approved", "faculty_head_approved"];

// Questions that only exist in the editor (not yet saved to the database)
const isUnsavedQuestionId = (id) =>
  typeof id === "number" || String(id).startsWith("restored-");

const transformQuestions = (rows) => {
  const seenIds = new Set();
  const uniqueRows = (rows || []).filter((q) => {
    if (!q || !q.id) return false;
    if (seenIds.has(q.id)) return false;
    seenIds.add(q.id);
    return true;
  });

  return uniqueRows.map((q) => {
    let correctAnswerValue;
    if (q.type === "mcq") {
      correctAnswerValue = Array.isArray(q.options)
        ? q.options.indexOf(q.correct_answer)
        : 0;
      if (correctAnswerValue === -1) correctAnswerValue = 0;
    } else if (q.type === "true_false") {
      correctAnswerValue = q.correct_answer === "true" ? 0 : 1;
    } else {
      correctAnswerValue = q.correct_answer;
    }
    return {
      id: q.id,
      type: q.type,
      text: q.text,
      options: q.type === "mcq" && Array.isArray(q.options)
        ? q.options
        : [""],
      correctAnswer: correctAnswerValue,
      points: q.points || 1,
      is_gad: q.is_gad || false,
      ai_generated: q.ai_generated || false,
      ai_revised: q.ai_revised || false,
    };
  });
};

export const InstructorQuiz = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { quizId } = useParams();
  const confirm = useConfirm();

  // Role-aware dynamic path routing
  const isAdminPath = location.pathname.startsWith("/admin-dashboard");
  const quizzesPath = isAdminPath
    ? "/admin-dashboard/quizzes"
    : "/instructor-dashboard/quizzes";
  const quizEditPath = (id) =>
    isAdminPath
      ? `/admin-dashboard/create-quiz/${id}`
      : `/instructor-dashboard/instructor-quiz/${id}`;
  const quizResultsPath = (id) =>
    isAdminPath
      ? `/admin-dashboard/quiz-results/${id}`
      : `/instructor-dashboard/quiz-results/${id}`;

  const [quizTitle, setQuizTitle] = useState("");
  const [quizDescription, setQuizDescription] = useState("");
  const [quizDuration, setQuizDuration] = useState("");
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(quizId ? true : false);
  const [error, setError] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [isPrivate, setIsPrivate] = useState(true);
  const [selectedSectionIds, setSelectedSectionIds] = useState([]);
  const [availableSections, setAvailableSections] = useState([]);
  const [saveStatus, setSaveStatus] = useState("");
  const [deletingQuestionId, setDeletingQuestionId] = useState(null);
  const [shareToken, setShareToken] = useState("");
  const [showShareUrl, setShowShareUrl] = useState(false);
  const [sectionShareTokens, setSectionShareTokens] = useState([]);
  const [showAddQuestionPopup, setShowAddQuestionPopup] = useState(false);
  const [questionCount, setQuestionCount] = useState(1);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [saveSectionsLoading, setSaveSectionsLoading] = useState(false);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [userId, setUserId] = useState(null);
  const [returnToQuizzesAfterAssign, setReturnToQuizzesAfterAssign] =
    useState(false);
  const [returnFilter, setReturnFilter] = useState("approved");
  const [lastSaved, setLastSaved] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [expandedQuestions, setExpandedQuestions] = useState(new Set());
  const [parentQuizId, setParentQuizId] = useState(null);
  const [restoredFromSnapshot, setRestoredFromSnapshot] = useState(0);
  const [autoSharing, setAutoSharing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewStatus, setReviewStatus] = useState(null);
  const [quizOwnerId, setQuizOwnerId] = useState(null);

  // A quiz is read-only once published, while it is in the review pipeline,
  // or when it belongs to another instructor.
  const isReviewLocked = REVIEW_LOCKED_STATUSES.includes(reviewStatus);
  const isNotOwner = Boolean(quizId && quizOwnerId && userId && quizOwnerId !== userId);
  const isLocked = isPublished || isReviewLocked || isNotOwner;
  // Only the instructor's own active sections can be assigned from the editor;
  // colleague sections added by subject auto-sharing are left untouched.
  const mySections = availableSections.filter(
    (s) => s.instructor_id === userId && !s.is_archived,
  );

  // Question Bank import modal state
  const [showBankModal, setShowBankModal] = useState(false);
  const [bankTargetIndex, setBankTargetIndex] = useState(null);

  const handleImportFromBank = (importedQuestion) => {
    if (bankTargetIndex !== null && bankTargetIndex >= 0 && bankTargetIndex < questions.length) {
      const updated = [...questions];
      const targetId = updated[bankTargetIndex].id;
      updated[bankTargetIndex] = {
        ...importedQuestion,
        id: targetId,
      };
      setQuestions(updated);
      setExpandedQuestions(new Set([...expandedQuestions, targetId]));
      setCurrentPage(Math.ceil((bankTargetIndex + 1) / QUESTIONS_PER_PAGE));
      markQuestionsDirty();
      notify.success(`Question #${bankTargetIndex + 1} updated from Question Bank!`);
    } else {
      const newQuestionObj = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        ...importedQuestion,
      };
      setQuestions([...questions, newQuestionObj]);
      setExpandedQuestions(new Set([...expandedQuestions, newQuestionObj.id]));
      setCurrentPage(Math.ceil((questions.length + 1) / QUESTIONS_PER_PAGE));
      markQuestionsDirty();
      notify.success("New question imported from Question Bank!");
    }
  };

  const handleImportManyFromBank = (importedQuestions) => {
    if (!importedQuestions?.length) return;
    const baseId = Date.now();
    const newQuestions = importedQuestions.map((q, i) => ({
      ...q,
      id: baseId + i * 1000 + Math.floor(Math.random() * 1000),
    }));
    // Show the first added question so the user sees where they landed
    setCurrentPage(Math.ceil((questions.length + 1) / QUESTIONS_PER_PAGE));
    setQuestions([...questions, ...newQuestions]);
    markQuestionsDirty();
    notify.success(
      `Added ${newQuestions.length} question${newQuestions.length > 1 ? "s" : ""} from the Question Bank.`,
    );
  };

  const parseCSVLine = (line) => {
    const result = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleImportCSVFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const content = ev.target?.result;
        if (!content) return;

        let parsedItems = [];

        if (file.name.toLowerCase().endsWith(".json")) {
          let json = JSON.parse(content);
          if (!Array.isArray(json)) {
            json = json.questions || json.data || json.items || [json];
          }
          parsedItems = json;
        } else {
          const lines = content.split(/\r?\n/).filter((l) => l.trim() !== "");
          if (lines.length < 2) {
            notify.error("CSV file must have a header row and at least one question row.");
            return;
          }
          const headers = parseCSVLine(lines[0]).map((h) =>
            h.toLowerCase().trim().replace(/^"|"$/g, "")
          );

          for (let i = 1; i < lines.length; i++) {
            const cols = parseCSVLine(lines[i]);
            const rowObj = {};
            headers.forEach((h, idx) => {
              let val = cols[idx] ?? "";
              if (val.startsWith('"') && val.endsWith('"')) {
                val = val.slice(1, -1).replace(/""/g, '"');
              }
              rowObj[h] = val;
            });
            parsedItems.push(rowObj);
          }
        }

        const newQuestions = [];
        const now = Date.now();

        parsedItems.forEach((raw, idx) => {
          const text =
            raw.text ||
            raw.question ||
            raw.question_text ||
            raw["question text"] ||
            raw.item_text ||
            "";

          if (!text || String(text).trim() === "") return;

          let type = (raw.type || raw.question_type || "mcq").toString().toLowerCase().trim();
          if (!["mcq", "true_false", "identification"].includes(type)) type = "mcq";

          const points = parseInt(raw.points || raw.weight || raw.score || 1) || 1;

          // Process options
          let options = [];
          if (Array.isArray(raw.options)) {
            options = raw.options.map((o) => String(o).trim());
          } else {
            for (let k = 1; k <= 6; k++) {
              const optVal =
                raw[`option_${k}`] ||
                raw[`option ${k}`] ||
                raw[`option${k}`] ||
                raw[String.fromCharCode(64 + k).toLowerCase()] ||
                raw[String.fromCharCode(64 + k)];
              if (optVal !== undefined && optVal !== null && String(optVal).trim() !== "") {
                options.push(String(optVal).trim());
              }
            }
          }

          if (type === "mcq") {
            while (options.length < 4) {
              options.push("");
            }
          } else if (type === "true_false") {
            options = ["True", "False"];
          }

          // Determine correct answer
          let rawCorrect =
            raw.correct_answer ??
            raw.correct ??
            raw["correct answer"] ??
            raw.answer ??
            0;

          let correctAnswer = 0;
          if (typeof rawCorrect === "number") {
            correctAnswer = rawCorrect;
          } else if (typeof rawCorrect === "string") {
            const trimmed = rawCorrect.trim();
            if (/^[A-F]$/i.test(trimmed)) {
              correctAnswer = trimmed.toUpperCase().charCodeAt(0) - 65;
            } else if (!isNaN(parseInt(trimmed))) {
              correctAnswer = parseInt(trimmed);
            } else {
              const matchedIdx = options.findIndex(
                (opt) => String(opt).trim().toLowerCase() === trimmed.toLowerCase()
              );
              if (matchedIdx !== -1) correctAnswer = matchedIdx;
            }
          }

          newQuestions.push({
            id: now + idx + Math.floor(Math.random() * 1000),
            type,
            text: String(text).trim(),
            options,
            correctAnswer: Math.max(0, Math.min(correctAnswer, options.length - 1)),
            points,
            difficulty: raw.difficulty || null,
            blooms_level: raw.blooms_level || raw.blooms || null,
          });
        });

        if (newQuestions.length === 0) {
          notify.error("No valid questions found in the CSV file.");
          return;
        }

        setQuestions((prev) => {
          const updated = [...prev, ...newQuestions];
          const newTotalPages = Math.ceil(updated.length / QUESTIONS_PER_PAGE);
          setCurrentPage(newTotalPages);
          return updated;
        });

        setExpandedQuestions((prev) => {
          const next = new Set(prev);
          newQuestions.forEach((q) => next.add(q.id));
          return next;
        });

        markQuestionsDirty();
        notify.success(`Successfully imported ${newQuestions.length} question(s) from CSV!`);
      } catch (err) {
        console.error("CSV import error:", err);
        notify.error("Failed to parse CSV file: " + err.message);
      } finally {
        if (e.target) e.target.value = "";
      }
    };

    reader.readAsText(file);
  };

  // Archive subject modal state
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [questionToArchive, setQuestionToArchive] = useState(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const QUESTIONS_PER_PAGE = 10;
  const totalPages = Math.ceil(questions.length / QUESTIONS_PER_PAGE);
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages || 1);
  const startIndex = (validCurrentPage - 1) * QUESTIONS_PER_PAGE;
  const endIndex = startIndex + QUESTIONS_PER_PAGE;
  const paginatedQuestions = questions.slice(startIndex, endIndex);

  const renderPageButtons = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      if (validCurrentPage > 3) {
        pages.push("...");
      }
      const start = Math.max(2, validCurrentPage - 1);
      const end = Math.min(totalPages - 1, validCurrentPage + 1);
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }
      if (validCurrentPage < totalPages - 2) {
        pages.push("...");
      }
      if (!pages.includes(totalPages)) pages.push(totalPages);
    }

    return pages.map((page, i) => {
      if (page === "...") {
        return (
          <span key={`dots-${i}`} className="px-2 text-sm text-gray-400 select-none">
            ...
          </span>
        );
      }
      return (
        <button
          key={page}
          type="button"
          onClick={() => setCurrentPage(page)}
          aria-label={`Go to question page ${page}`}
          aria-current={validCurrentPage === page ? "page" : undefined}
          className={`w-8 h-8 text-xs font-semibold rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 ${
            validCurrentPage === page
              ? "bg-brand-gold text-brand-navy font-bold shadow-sm"
              : "border border-gray-200 hover:bg-gray-50 text-gray-600"
          }`}
        >
          {page}
        </button>
      );
    });
  };

  const toggleQuestion = (questionId) => {
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };
  const autoSaveTimer = useRef(null);
  const initialLoadDone = useRef(false);
  // Question edits are only persisted by an explicit save; auto-save covers quiz details
  const questionsDirtyRef = useRef(false);

  // Track unsaved changes after initial load
  const markDirty = useCallback(() => {
    if (initialLoadDone.current) {
      setHasUnsavedChanges(true);
    }
  }, []);

  const markQuestionsDirty = useCallback(() => {
    if (initialLoadDone.current) {
      questionsDirtyRef.current = true;
      setHasUnsavedChanges(true);
    }
  }, []);

  // Guards against overlapping background saves; leave-guards call the latest save via saveQuizRef
  const autoSavingRef = useRef(false);
  const saveQuizRef = useRef(null);
  const saveInFlightRef = useRef(null);

  // Warn before closing the tab with unsaved changes, and start saving while
  // the browser's "Leave site?" prompt is open
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleBeforeUnload = (e) => {
      if (quizId && !isLocked && !autoSavingRef.current) {
        autoSavingRef.current = true;
        saveQuizRef.current?.(false, false, { keepRoute: true, silent: true }).finally(() => {
          autoSavingRef.current = false;
        });
      }
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges, quizId, isLocked]);

  useEscapeKey(() => setShowAddQuestionPopup(false), showAddQuestionPopup);
  useEscapeKey(() => {
    if (!saveSectionsLoading) handleCloseSectionModal();
  }, showSectionModal);
  const addQuestionTrapRef = useFocusTrap(showAddQuestionPopup);
  const sectionTrapRef = useFocusTrap(showSectionModal);

  // Unsaved changes are saved automatically when leaving; see the navigation blocker below
  const leaveEditor = () => {
    navigate(quizzesPath);
  };

  // Mirrors hasUnsavedChanges synchronously, so navigation right after a save
  // isn't blocked by state that hasn't re-rendered yet
  const unsavedRef = useRef(false);
  useEffect(() => {
    unsavedRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  // Auto-save before leaving the editor through any in-app navigation
  const leaveBlocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      unsavedRef.current && !isLocked && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (leaveBlocker.state !== "blocked") return;
    let cancelled = false;

    const saveThenLeave = async () => {
      setSaveStatus("Saving...");
      const result = await saveQuizRef.current?.(false, false, { keepRoute: true });
      if (cancelled) return;
      if (result && !result.error) {
        notify.success("Quiz saved.");
        leaveBlocker.proceed();
        return;
      }
      const leaveAnyway = await confirm({
        title: "Couldn't Auto-save",
        message: `${result?.error || "The quiz couldn't be saved."} Leave without saving your changes?`,
        confirmText: "Leave Without Saving",
        cancelText: "Stay and Fix",
        variant: "warning",
      });
      if (cancelled) return;
      if (leaveAnyway) {
        unsavedRef.current = false;
        leaveBlocker.proceed();
      } else {
        leaveBlocker.reset();
      }
    };
    saveThenLeave();

    return () => {
      cancelled = true;
    };
    // Runs once per blocked navigation; the save function is read from a ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaveBlocker.state]);

  // Best-effort save when the tab is hidden or closed (the browser may not wait
  // for it, so the beforeunload warning above still guards the tab close)
  useEffect(() => {
    if (!quizId) return;
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== "hidden") return;
      if (!unsavedRef.current || isLocked || autoSavingRef.current) return;
      autoSavingRef.current = true;
      try {
        await saveQuizRef.current?.(false, false, { keepRoute: true, silent: true });
      } finally {
        autoSavingRef.current = false;
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [quizId, isLocked]);

  // Auto-save quiz details 30 seconds after the last change
  useEffect(() => {
    if (!quizId || isLocked || !hasUnsavedChanges) return;

    autoSaveTimer.current = setTimeout(async () => {
      if (!quizTitle.trim()) return;
      const parsedDuration = quizDuration ? parseInt(quizDuration) : null;
      if (parsedDuration !== null && (isNaN(parsedDuration) || parsedDuration < 1)) return;
      try {
        const { error: autoSaveError } = await supabase
          .from("quizzes")
          .update({
            title: quizTitle,
            description: quizDescription || null,
            duration: parsedDuration,
            is_private: isPrivate,
          })
          .eq("id", quizId);
        if (autoSaveError) throw autoSaveError;
        setLastSaved(new Date());
        if (!questionsDirtyRef.current) setHasUnsavedChanges(false);
      } catch (err) {
        console.error("Auto-save failed:", err);
      }
    }, 30000);

    return () => clearTimeout(autoSaveTimer.current);
  }, [hasUnsavedChanges, quizTitle, quizDescription, quizDuration, quizId, isLocked, isPrivate]);

  useEffect(() => {
    loadSections();
    if (quizId) {
      loadQuiz();
    } else {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    if (location.state?.openSections) {
      setReturnToQuizzesAfterAssign(Boolean(location.state?.returnToQuizzes));
      setReturnFilter(location.state?.returnFilter || "approved");
      setShowSectionModal(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);

  // Add/remove only the changed section links so existing rows (and their
  // section-specific share tokens) are preserved.
  const syncQuizSections = async (targetQuizId, sectionIds) => {
    const { data: existingRows, error: existingError } = await supabase
      .from("quiz_sections")
      .select("section_id")
      .eq("quiz_id", targetQuizId);
    if (existingError) throw existingError;

    const existingIds = new Set((existingRows || []).map((r) => r.section_id));
    const wantedIds = new Set(sectionIds);
    const toRemove = [...existingIds].filter((id) => !wantedIds.has(id));
    const toAdd = [...wantedIds].filter((id) => !existingIds.has(id));

    if (toRemove.length > 0) {
      const { error: deleteError } = await supabase
        .from("quiz_sections")
        .delete()
        .eq("quiz_id", targetQuizId)
        .in("section_id", toRemove);
      if (deleteError) throw deleteError;
    }

    if (toAdd.length > 0) {
      const { error: insertError } = await supabase
        .from("quiz_sections")
        .insert(toAdd.map((sectionId) => ({ quiz_id: targetQuizId, section_id: sectionId })));
      if (insertError) throw insertError;
    }

    const { error: updateError } = await supabase
      .from("quizzes")
      .update({ section_id: sectionIds[0] || null })
      .eq("id", targetQuizId);
    if (updateError) throw updateError;
  };

  const saveSectionAssignments = async () => {
    if (!quizId) return;

    setSaveSectionsLoading(true);
    try {
      await syncQuizSections(quizId, selectedSectionIds);

      const { data: sectionTokens } = await supabase
        .from("quiz_sections")
        .select("share_token, section_id, sections(*)")
        .eq("quiz_id", quizId);
      if (sectionTokens) setSectionShareTokens(sectionTokens);
    } finally {
      setSaveSectionsLoading(false);
    }
  };

  const handleCloseSectionModal = async () => {
    if (isLocked) {
      setShowSectionModal(false);
      return;
    }
    if (selectedSectionIds.length === 0) {
      notify.warning("Select at least one section for this quiz.");
      return;
    }
    try {
      await saveSectionAssignments();
      setShowSectionModal(false);
      notify.success("Section assignments saved.");

      if (returnToQuizzesAfterAssign) {
        navigate(quizzesPath, {
          state: { filter: returnFilter || "approved" },
        });
      }
    } catch (err) {
      console.error("Failed to save section assignments:", err);
      notify.error("Failed to save section assignments: " + err.message);
    }
  };

  const handleAutoShareWithSubjectSections = async () => {
    if (!quizId) return;
    
    setAutoSharing(true);
    try {
      const { data, error } = await supabase.rpc("auto_share_quiz_with_subject_sections", {
        p_quiz_id: quizId
      });
      
      if (error) throw error;
      
      notify.success(`Quiz shared with ${data || 0} section(s)`);
      
      // Reload sections and tokens
      loadQuiz();
    } catch (err) {
      console.error("Auto-share failed:", err);
      notify.error("Failed to auto-share quiz: " + err.message);
    } finally {
      setAutoSharing(false);
    }
  };

  const loadSections = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data: mySections } = await supabase
        .from("sections")
        .select("*")
        .eq("instructor_id", user.id);

      const subjectIds = Array.from(
        new Set((mySections || []).map((s) => s.subject_id).filter(Boolean))
      );

      let allSections = mySections || [];
      if (subjectIds.length > 0) {
        const { data: subjectSections } = await supabase
          .from("sections")
          .select("*")
          .in("subject_id", subjectIds)
          .eq("is_archived", false);

        if (subjectSections && subjectSections.length > 0) {
          const sectionMap = new Map();
          [...allSections, ...subjectSections].forEach((s) =>
            sectionMap.set(s.id, s)
          );
          allSections = Array.from(sectionMap.values());
        }
      }

      setAvailableSections(allSections);
    } catch (e) {
      console.error("Failed to load sections", e);
    }
  };

  const loadQuiz = async () => {
    try {
      const { data: quiz, error: quizError } = await supabase
        .from("quizzes")
        .select("*")
        .eq("id", quizId)
        .single();

      if (quizError) throw quizError;
      if (!quiz) throw new Error("Quiz not found");

      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (quiz.is_private !== false && currentUser?.id && quiz.instructor_id !== currentUser.id) {
        notify.error("Permission denied: This quiz is private and can only be accessed by its owner.");
        navigate(quizzesPath);
        return;
      }

      const loadedTitle = quiz.is_published
        ? (quiz.title || "").replace(/\s*\(Revised(?:\s+\d+)?\)\s*$/, "")
        : quiz.title;
      setQuizTitle(loadedTitle);
      setQuizDescription(quiz.description || "");
      setQuizDuration(quiz.duration || "");
      setIsPublished(quiz.is_published || false);
      setIsPrivate(quiz.is_private !== false);
      setShareToken(quiz.share_token || "");
      setParentQuizId(quiz.parent_quiz_id || null);
      setQuizOwnerId(quiz.instructor_id || null);

      // Latest review submission decides whether the content is locked
      let latestStatus = null;
      if (currentUser?.id) {
        const { data: latestSub } = await supabase
          .from("quiz_analysis_submissions")
          .select("status")
          .eq("quiz_id", quizId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        latestStatus = latestSub?.status || null;
      }
      setReviewStatus(latestStatus);

      const isOwner = currentUser?.id && quiz.instructor_id === currentUser.id;
      const contentLocked =
        quiz.is_published || REVIEW_LOCKED_STATUSES.includes(latestStatus) || !isOwner;

      // Auto-share with any new sections in the same subject (owner drafts only)
      if (!contentLocked) {
        try {
          await supabase.rpc("auto_share_quiz_with_subject_sections", {
            p_quiz_id: quizId,
          });
        } catch (e) {
          console.warn("Auto-share on load skipped:", e);
        }
      }

      // Load section-specific share tokens
      const { data: sectionTokens } = await supabase
        .from("quiz_sections")
        .select("share_token, section_id, sections(*)")
        .eq("quiz_id", quizId);

      if (sectionTokens && sectionTokens.length > 0) {
        setSectionShareTokens(sectionTokens);

        const missingTokens = sectionTokens.filter((st) => !st.share_token);
        if (missingTokens.length > 0 && isOwner) {
          const { error: genError } = await supabase.rpc("generate_share_tokens_for_quiz", {
            p_quiz_id: quizId,
          });
          if (!genError) {
            const { data: newTokens } = await supabase
              .from("quiz_sections")
              .select("share_token, section_id, sections(*)")
              .eq("quiz_id", quizId);
            if (newTokens) setSectionShareTokens(newTokens);
          }
        }
        setSelectedSectionIds(sectionTokens.map((d) => d.section_id));
      } else if (quiz.section_id) {
        setSelectedSectionIds([quiz.section_id]); // fallback for old data
      }

      const isMissingTableErr = (err) => {
        if (!err) return false;
        const msg = (err.message || "").toLowerCase();
        const code = err.code || "";
        return (
          code === "42P01" ||
          msg.includes("could not find the table") ||
          msg.includes("does not exist") ||
          (msg.includes("relation") && msg.includes("does not exist"))
        );
      };

      const loadViaJunction = async (id) => {
        try {
          const { data, error } = await supabase
            .from("quiz_questions")
            .select("questions(*), order_index")
            .eq("quiz_id", id)
            .order("order_index", { ascending: true });
          if (isMissingTableErr(error) || error) return null;
          if (!data || data.length === 0) {
            return { source: "junction-empty", rows: [] };
          }
          const rows = data
            .map((r) => r.questions)
            .filter(
              (q) =>
                q !== null &&
                (q.is_archived === null || q.is_archived === false),
            );
          return { source: "junction", rows };
        } catch {
          return null;
        }
      };

      const loadDirect = async (id) => {
        const { data, error } = await supabase
          .from("questions")
          .select("*")
          .eq("quiz_id", id)
          .or("is_archived.is.null,is_archived.eq.false")
          .order("created_at", { ascending: true });
        if (error) return null;
        return { source: "direct", rows: data || [] };
      };

      let resolved = null;

      // 1. Primary source: questions directly saved under this quiz ID
      const direct = await loadDirect(quizId);
      if (direct && direct.rows.length > 0) {
        resolved = direct;
      }

      // 2. Secondary source: questions linked via quiz_questions junction
      if (!resolved || resolved.rows.length === 0) {
        const junction = await loadViaJunction(quizId);
        if (junction && junction.rows.length > 0) {
          resolved = junction;
        }
      }

      // 3. Fallback: if revision copy has no saved questions yet, load from parent quiz
      if (!resolved || resolved.rows.length === 0) {
        if (quiz.parent_quiz_id) {
          const parentDirect = await loadDirect(quiz.parent_quiz_id);
          if (parentDirect && parentDirect.rows.length > 0) {
            resolved = parentDirect;
          } else {
            const parentViaJunction = await loadViaJunction(quiz.parent_quiz_id);
            if (parentViaJunction && parentViaJunction.rows.length > 0) {
              resolved = parentViaJunction;
            }
          }
        }
      }

      if (!resolved || resolved.rows.length === 0) {
        try {
          const { data: sub } = await supabase
            .from("quiz_analysis_submissions")
            .select("analysis_results")
            .eq("quiz_id", quizId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const snapshots =
            sub?.analysis_results?.questionSnapshots ||
            sub?.analysis_results?.analysis ||
            [];

          if (Array.isArray(snapshots) && snapshots.length > 0) {
            const restored = snapshots
              .slice()
              .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
              .map((snap) => {
                const qType = snap.type || "mcq";
                const isMCQ = qType === "mcq";
                const isTF = qType === "true_false";
                let rawOptions =
                  isMCQ && Array.isArray(snap.options) ? snap.options : [];
                while (isMCQ && rawOptions.length < 4) rawOptions.push("");
                rawOptions = rawOptions.filter(
                  (o, idx) =>
                    !isMCQ ||
                    idx < 4 ||
                    String(o || "").trim().length > 0,
                );
                if (isMCQ && rawOptions.length < 4) {
                  while (rawOptions.length < 4) rawOptions.push("");
                }

                let correctIdx = 0;
                const snapCorrect = snap.correctAnswer;
                if (isMCQ) {
                  if (typeof snapCorrect === "number") {
                    correctIdx = snapCorrect;
                  } else if (
                    typeof snapCorrect === "string" &&
                    rawOptions.length > 0
                  ) {
                    const matchIdx = rawOptions.findIndex(
                      (opt) =>
                        String(opt || "").toLowerCase() ===
                        String(snapCorrect || "").toLowerCase(),
                    );
                    if (matchIdx !== -1) correctIdx = matchIdx;
                  }
                } else if (isTF) {
                  correctIdx =
                    String(snapCorrect || "true").toLowerCase() === "true"
                      ? 0
                      : 1;
                }

                return {
                  id: `restored-${snap.questionId || Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                  type: isTF ? "true_false" : qType,
                  text: snap.questionText || snap.text || "",
                  options: isMCQ ? rawOptions : [""],
                  correctAnswer: isTF || isMCQ ? correctIdx : (snapCorrect ?? ""),
                  points: 1,
                  _restoredFromSnapshot: true,
                };
              });

            setQuestions(restored);
            setRestoredFromSnapshot(restored.length);
            setTimeout(() => {
              initialLoadDone.current = true;
            }, 100);
            return;
          }
        } catch (subErr) {
          console.warn(
            "[loadQuiz] Could not restore from analysis submission snapshot",
            subErr,
          );
        }
      }

      const finalRows = resolved?.rows || [];
      setQuestions(transformQuestions(finalRows));
      setTimeout(() => { initialLoadDone.current = true; }, 100);
    } catch (err) {
      setError(err.message || "Failed to load quiz");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addQuestion = () => {
    setQuestionCount(1);
    setShowAddQuestionPopup(true);
  };

  const addMultipleQuestions = (count) => {
    const newQuestions = Array.from({ length: count }, (_, i) => ({
      id: Date.now() + i,
      type: "mcq",
      text: "",
      options: ["", "", "", ""],
      correctAnswer: 0,
      points: 1,
      is_gad: false,
      ai_generated: false,
      ai_revised: false,
    }));
    // Auto-expand new questions
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      newQuestions.forEach((q) => next.add(q.id));
      return next;
    });
    const updated = [...questions, ...newQuestions];
    setQuestions(updated);
    markQuestionsDirty();
    setShowAddQuestionPopup(false);
    const newTotalPages = Math.ceil(updated.length / QUESTIONS_PER_PAGE);
    setCurrentPage(newTotalPages);
  };

  const updateQuestion = (id, field, value) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, [field]: value } : q)),
    );
    markQuestionsDirty();
  };

  const updateOption = (questionId, optionIndex, value) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId
          ? {
              ...q,
              options: q.options.map((opt, idx) =>
                idx === optionIndex ? value : opt,
              ),
            }
          : q,
      ),
    );
    markQuestionsDirty();
  };

  const addOption = (questionId) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId ? { ...q, options: [...q.options, ""] } : q,
      ),
    );
    markQuestionsDirty();
  };

  // Keep the correct answer pointing at the same option after a removal
  const removeOption = (questionId, optionIndex) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== questionId) return q;
        let correctAnswer = q.correctAnswer;
        if (typeof correctAnswer === "number") {
          if (optionIndex === correctAnswer) correctAnswer = 0;
          else if (optionIndex < correctAnswer) correctAnswer -= 1;
        }
        return {
          ...q,
          options: q.options.filter((_, idx) => idx !== optionIndex),
          correctAnswer,
        };
      }),
    );
    markQuestionsDirty();
  };

  const removeQuestionLocally = (id) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
    markQuestionsDirty();
  };

  const generateShareToken = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let token = "";
    for (let i = 0; i < 12; i++) {
      // Increased length for better uniqueness
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  };

  const copyToClipboard = (url) => {
    navigator.clipboard.writeText(url).then(() => {
      setSaveStatus("URL copied to clipboard!");
      setTimeout(() => setSaveStatus(""), 2000);
    });
  };

  const archiveQuestion = async (id) => {
    setDeletingQuestionId(id);

    // Unsaved questions have nothing to archive; just remove them from the editor
    if (isUnsavedQuestionId(id)) {
      removeQuestionLocally(id);
      setDeletingQuestionId(null);
      return;
    }

    // If it's a saved question from database, show subject selection modal
    const questionToArchiveItem = questions.find((q) => q.id === id);
    if (questionToArchiveItem) {
      setQuestionToArchive(questionToArchiveItem);
      setShowSubjectModal(true);
    }
    setDeletingQuestionId(null);
  };

  // Handle subject selection for archiving
  const handleArchiveWithSubject = async (sectionId) => {
    if (!questionToArchive) return;

    try {
      const updateData = { 
        is_archived: true, 
        updated_at: new Date().toISOString() 
      };

      if (sectionId) {
        updateData.section_id = sectionId;
      }

      const { error } = await supabase
        .from("questions")
        .update(updateData)
        .eq("id", questionToArchive.id);

      if (error) throw error;

      // Remove from local state for instant UI feedback
      setQuestions((prevQuestions) => prevQuestions.filter((q) => q.id !== questionToArchive.id));
      notify.success(
        "Question archived to Question Bank! You can restore it from there.",
      );
      
      setShowSubjectModal(false);
      setQuestionToArchive(null);
    } catch (err) {
      console.error("Error archiving question:", err);
      notify.error("Error archiving question: " + err.message);
    }
  };

  const performSaveQuiz = async (publish = false, redirectOnSave = true, { keepRoute = false, silent = false } = {}) => {
    // Background saves (leaving the editor, switching tabs) stay quiet
    const reportError = silent ? () => {} : setError;
    reportError("");

    if (isLocked) {
      const err = isPublished
        ? "This quiz is published and can no longer be edited."
        : isNotOwner
          ? "Only the quiz owner can edit this quiz."
          : "This quiz is under review and can't be edited until the review is finished.";
      reportError(err);
      return { error: err };
    }

    setSaveStatus("Saving...");

    const parsedDuration = quizDuration === "" || quizDuration === null ? null : parseInt(quizDuration);
    if (parsedDuration !== null && (isNaN(parsedDuration) || parsedDuration < 1)) {
      const err = "Duration must be at least 1 minute, or left blank for no time limit.";
      reportError(err);
      setSaveStatus("");
      return { error: err };
    }

    if (!quizTitle.trim()) {
      const err = "Quiz title is required";
      reportError(err);
      setSaveStatus("");
      return { error: err };
    }

    if (publish && questions.length === 0) {
      const err = "Add at least one question before publishing";
      reportError(err);
      setSaveStatus("");
      return { error: err };
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text || !q.text.trim()) {
        const err = `Question #${i + 1} has no question text. Please enter the question or remove it.`;
        reportError(err);
        setSaveStatus("");
        return { error: err };
      }
      if (
        q.type === "mcq" &&
        (!Array.isArray(q.options) ||
          q.options.filter((opt) => opt && typeof opt === "string" && opt.trim()).length < 2)
      ) {
        const err = `Question #${i + 1} must have at least 2 non-empty options.`;
        reportError(err);
        setSaveStatus("");
        return { error: err };
      }
      if (
        q.type === "mcq" &&
        typeof q.correctAnswer === "number" &&
        !String(q.options?.[q.correctAnswer] || "").trim()
      ) {
        const err = `Question #${i + 1}: the option marked as correct is empty. Fill it in or choose another correct answer.`;
        reportError(err);
        setSaveStatus("");
        return { error: err };
      }
    }

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        const err = "User not authenticated. Please log in again.";
        reportError(err);
        setSaving(false);
        setSaveStatus("");
        return { error: err };
      }

      let quizData;
      let newToken = shareToken;

      const formatCorrectAnswer = (q) => {
        if (q.type === "mcq") {
          const opts = (q.options || []).filter((opt) => opt && typeof opt === "string" && opt.trim());
          // Read the answer from the unfiltered list: the index refers to the
          // options as shown in the editor, blanks included.
          const selected =
            typeof q.correctAnswer === "number" ? q.options?.[q.correctAnswer] : null;
          if (typeof selected === "string" && selected.trim()) {
            return selected;
          }
          if (typeof q.correctAnswer === "string" && q.correctAnswer.trim()) {
            return q.correctAnswer.trim();
          }
          return opts[0] || "N/A";
        }
        if (q.type === "true_false") {
          return q.correctAnswer === 0 || q.correctAnswer === "true" || q.correctAnswer === true
            ? "true"
            : "false";
        }
        return String(q.correctAnswer || "N/A").trim() || "N/A";
      };

      const safeUpdateQuestion = async (q) => {
        const payload = {
          text: q.text,
          options:
            q.type === "mcq"
              ? (q.options || []).filter((opt) => opt && typeof opt === "string" && opt.trim())
              : null,
          correct_answer: formatCorrectAnswer(q),
          points: q.points ? parseInt(q.points) : 1,
          is_gad: q.is_gad || false,
          ai_generated: q.ai_generated || false,
          ai_revised: q.ai_revised || false,
        };

        let { error } = await supabase.from("questions").update(payload).eq("id", q.id);
        if (
          error &&
          (error.message?.includes("is_gad") ||
            error.message?.includes("ai_") ||
            error.code === "42703" ||
            error.code === "PGRST204")
        ) {
          delete payload.is_gad;
          delete payload.ai_generated;
          delete payload.ai_revised;
          const retry = await supabase.from("questions").update(payload).eq("id", q.id);
          error = retry.error;
        }
        return error;
      };

      const safeInsertQuestions = async (rows) => {
        let { data, error } = await supabase.from("questions").insert(rows).select();
        if (
          error &&
          (error.message?.includes("is_gad") ||
            error.message?.includes("ai_") ||
            error.code === "42703" ||
            error.code === "PGRST204")
        ) {
          const fallbackRows = rows.map((r) => {
            const copy = { ...r };
            delete copy.is_gad;
            delete copy.ai_generated;
            delete copy.ai_revised;
            return copy;
          });
          const retry = await supabase.from("questions").insert(fallbackRows).select();
          error = retry.error;
          data = retry.data;
        }
        return { data, error };
      };

      if (quizId) {
        // Keep an existing share token so links already sent to students keep working
        if (publish && !newToken) {
          newToken = generateShareToken();
        }

        const cleanTitle = (publish || isPublished)
          ? quizTitle.replace(/\s*\(Revised(?:\s+\d+)?\)\s*$/, "")
          : quizTitle;

        const { data, error: updateError } = await supabase
          .from("quizzes")
          .update({
            title: cleanTitle,
            description: quizDescription || null,
            duration: parsedDuration,
            is_published: publish || isPublished,
            is_private: isPrivate,
            share_token: newToken || null,
          })
          .eq("id", quizId)
          .select();

        if (updateError) throw updateError;
        if (!data || data.length === 0) {
          throw new Error("You don't have permission to edit this quiz.");
        }
        quizData = data[0];

        // Only active questions are compared with the editor. Archived questions
        // were deliberately moved to the Question Bank and must not be deleted.
        const { data: existingQuestions } = await supabase
          .from("questions")
          .select("id")
          .eq("quiz_id", quizId)
          .or("is_archived.is.null,is_archived.eq.false");
        const existingQuestionIds = new Set(
          existingQuestions?.map((q) => q.id) || [],
        );

        // Delete questions that were removed in the editor
        const currentQuestionIds = new Set(questions.map((q) => q.id));
        const idsToDelete = [...existingQuestionIds].filter(
          (id) => !currentQuestionIds.has(id),
        );
        if (idsToDelete.length > 0) {
          await supabase.from("questions").delete().in("id", idsToDelete);
          try {
            await supabase
              .from("quiz_questions")
              .delete()
              .in("question_id", idsToDelete);
          } catch (delJuncErr) {
            console.warn("quiz_questions deletion skipped:", delJuncErr);
          }
        }

        for (const q of questions) {
          if (!isUnsavedQuestionId(q.id) && existingQuestionIds.has(q.id)) {
            const updateErr = await safeUpdateQuestion(q);
            if (updateErr) throw updateErr;
          }
        }

        const baseSaveTime = Date.now();
        const questionsToAdd = questions
          .filter((q) => !existingQuestionIds.has(q.id))
          .map((q, idx) => ({
            quiz_id: quizData.id,
            section_id: selectedSectionIds[0] || null,
            type: q.type || "mcq",
            text: q.text,
            options:
              q.type === "mcq"
                ? (q.options || []).filter((opt) => opt && typeof opt === "string" && opt.trim())
                : null,
            correct_answer: formatCorrectAnswer(q),
            points: q.points ? parseInt(q.points) : 1,
            is_archived: false,
            is_gad: q.is_gad || false,
            ai_generated: q.ai_generated || false,
            ai_revised: q.ai_revised || false,
            created_at: new Date(baseSaveTime + idx * 100).toISOString(),
          }));

        if (questionsToAdd.length > 0) {
          const { error: questionsError } = await safeInsertQuestions(questionsToAdd);
          if (questionsError) {
            console.error("Error inserting new questions into database:", questionsError);
            throw questionsError;
          }
        }
      } else {
        newToken = publish ? generateShareToken() : null;

        const { data: newQuiz, error: quizError } = await supabase
          .from("quizzes")
          .insert([
            {
              instructor_id: user.id,
              section_id: selectedSectionIds[0] || null,
              title: quizTitle,
              description: quizDescription || null,
              duration: parsedDuration,
              is_published: publish,
              is_private: isPrivate,
              share_token: newToken,
            },
          ])
          .select();

        if (quizError) throw quizError;
        if (!newQuiz || newQuiz.length === 0)
          throw new Error("Failed to create quiz");
        quizData = newQuiz[0];

        // Log quiz creation in workflow history & audit log
        try {
          await supabase.rpc("log_quiz_status_change", {
            p_quiz_id: quizData.id,
            p_new_status: publish ? "published" : "draft",
            p_reason: publish ? "Quiz created and published live" : "Quiz created by instructor",
          });

          await logAudit({
            action: publish ? "QUIZ_PUBLISHED" : "QUIZ_CREATED",
            tableName: "quizzes",
            recordId: quizData.id,
            itemName: quizTitle,
            previousStatus: null,
            newStatus: publish ? "published" : "draft",
            reason: publish ? "Quiz created and published live" : "Quiz created by instructor",
          });
        } catch (hErr) {
          console.warn("Could not log quiz workflow history:", hErr);
        }

        if (questions.length > 0) {
          const baseCreateTime = Date.now();
          const questionsData = questions.map((q, idx) => ({
            quiz_id: quizData.id,
            section_id: selectedSectionIds[0] || null,
            type: q.type || "mcq",
            text: q.text,
            options:
              q.type === "mcq"
                ? (q.options || []).filter((opt) => opt && typeof opt === "string" && opt.trim())
                : null,
            correct_answer: formatCorrectAnswer(q),
            points: q.points ? parseInt(q.points) : 1,
            is_archived: false,
            is_gad: q.is_gad || false,
            ai_generated: q.ai_generated || false,
            ai_revised: q.ai_revised || false,
            created_at: new Date(baseCreateTime + idx * 100).toISOString(),
          }));
          const { error: questionsError } = await safeInsertQuestions(questionsData);
          if (questionsError) {
            console.error("Error inserting questions for new quiz into database:", questionsError);
            throw questionsError;
          }
        }

        if (!keepRoute) navigate(quizEditPath(quizData.id), { replace: true });
      }

      // Sync the many-to-many relationship in quiz_sections
      if (quizData) {
        try {
          await syncQuizSections(quizData.id, selectedSectionIds);
        } catch (tableError) {
          console.warn("Could not sync quiz sections:", tableError);
        }

        try {
          const { data: allQuestions, error: qsFetchErr } = await supabase
            .from("questions")
            .select("*")
            .eq("quiz_id", quizData.id)
            .or("is_archived.is.null,is_archived.eq.false")
            .order("created_at", { ascending: true });

          if (!qsFetchErr && allQuestions && allQuestions.length > 0) {
            await supabase
              .from("quiz_questions")
              .delete()
              .eq("quiz_id", quizData.id);

            const junctionRows = allQuestions.map((q, idx) => ({
              quiz_id: quizData.id,
              question_id: q.id,
              order_index: idx,
            }));

            const { error: juncInsErr } = await supabase
              .from("quiz_questions")
              .insert(junctionRows);

            if (juncInsErr) {
              const msg = (juncInsErr.message || "").toLowerCase();
              const code = juncInsErr.code || "";
              const isMissingTable =
                code === "42P01" ||
                msg.includes("could not find the table") ||
                msg.includes("does not exist") ||
                (msg.includes("relation") && msg.includes("does not exist"));
              if (!isMissingTable) throw juncInsErr;
            }

            // Update React state with real database UUID questions
            setQuestions(transformQuestions(allQuestions));
          }
        } catch (junctionSyncErr) {
          console.warn(
            "quiz_questions sync skipped (table may not exist yet):",
            junctionSyncErr,
          );
        }
      }

      if (newToken) setShareToken(newToken);
      setRestoredFromSnapshot(0);
      questionsDirtyRef.current = false;
      unsavedRef.current = false;
      setHasUnsavedChanges(false);
      setLastSaved(new Date());

      if (publish) {
        setShowShareUrl(true);
        setSaveStatus("Quiz published! Share URL generated.");
        setTimeout(() => setSaveStatus(""), 3000);
      } else {
        setSaveStatus("Draft saved!");
        if (redirectOnSave) {
          setTimeout(() => {
            setSaveStatus("");
            navigate(quizzesPath);
          }, 1000);
        } else {
          setTimeout(() => setSaveStatus(""), 2000);
        }
      }

      if (!quizId && quizData?.id) {
        if (!keepRoute) navigate(quizEditPath(quizData.id), { replace: true });
      }
      return quizData || true;
    } catch (err) {
      const msg = err.message || "Failed to save quiz";
      reportError(msg);
      setSaveStatus("");
      console.error("[handleSaveQuiz error]:", err);
      return { error: msg };
    } finally {
      setSaving(false);
    }
  };

  // Only one save runs at a time: a manual save and an auto-save started
  // together share the same run instead of inserting new questions twice
  const handleSaveQuiz = (...args) => {
    if (saveInFlightRef.current) return saveInFlightRef.current;
    const run = performSaveQuiz(...args).finally(() => {
      saveInFlightRef.current = null;
    });
    saveInFlightRef.current = run;
    return run;
  };

  // Leave-guards call the latest save through this ref
  useEffect(() => {
    saveQuizRef.current = handleSaveQuiz;
  });

  if (loading) {
    return (
      <div className="flex-1 overflow-auto bg-authentic-white" aria-label="Loading quiz">
        <div className="bg-gradient-to-r from-brand-navy to-brand-indigo px-6 py-5">
          <Skeleton tone="bg-white/20" className="h-7 w-64 max-w-full rounded-md mb-2" />
          <Skeleton tone="bg-white/20" className="h-4 w-96 max-w-full rounded-md" />
        </div>
        <div className="p-6 space-y-4">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-authentic-white">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-brand-navy to-brand-indigo px-6 py-5">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={leaveEditor}
            aria-label="Back to quizzes"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Quizzes
          </button>
          <span className="text-white/40">/</span>
          <span className="text-white/70 text-sm">
            {quizId ? "Edit Quiz" : "New Quiz"}
          </span>
        </div>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              {quizTitle || (quizId ? "Edit Quiz" : "New Quiz")}
            </h1>
            <p className="text-white/60 text-sm mt-1">
              {isPublished
                ? "Published quiz - view results and share links"
                : isReviewLocked
                  ? "In the review process - read-only until the review is finished"
                  : isNotOwner
                    ? "Shared quiz - read-only"
                    : "Draft - add questions and submit for review when ready"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Status pill */}
            {(() => {
              const pill = isPublished
                ? { label: "Published", cls: "bg-green-500/20 text-green-300 border border-green-500/30" }
                : reviewStatus === "approved" || reviewStatus === "faculty_head_approved"
                  ? { label: "Approved", cls: "bg-green-500/20 text-green-300 border border-green-500/30" }
                  : reviewStatus === "pending" || reviewStatus === "faculty_head_review"
                    ? { label: "In Review", cls: "bg-blue-500/20 text-blue-200 border border-blue-400/30" }
                    : reviewStatus === "revision_requested"
                      ? { label: "Needs Revision", cls: "bg-rose-500/20 text-rose-200 border border-rose-400/30" }
                      : { label: "Draft", cls: "bg-brand-gold/20 text-brand-gold border border-brand-gold/30" };
              return (
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${pill.cls}`}>
                  {pill.label}
                </span>
              );
            })()}
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-white/90 border border-white/20">
              {isPrivate ? "Private" : "Public"}
            </span>
          </div>
        </div>

        {/* Quick action buttons for published quizzes */}
        {quizId && isPublished && (
          <div className="flex gap-2 mt-4">
            <button
              onClick={() =>
                navigate(quizResultsPath(quizId))
              }
              className="bg-white/15 hover:bg-white/25 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              View Results
            </button>
          </div>
        )}
      </div>

      <div className="p-6">
      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {error}
        </div>
      )}
      {saveStatus && (
        <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
          {saveStatus}
        </div>
      )}

      {(showShareUrl || isPublished) && (
        <div className="mb-6 p-6 bg-brand-navy/5 border-2 border-brand-navy/20 rounded-lg">
          <h3 className="text-lg font-bold text-brand-navy mb-3 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {showShareUrl ? "Quiz Published Successfully!" : "Share Links"}
          </h3>
          <p className="text-gray-700 mb-4">
            Each section has its own unique share code. Share the corresponding code with each section:
          </p>
          
          {sectionShareTokens.length > 0 ? (
            <div className="space-y-3">
              {(() => {
                const userTokens = sectionShareTokens.filter(
                  (st) => st.sections?.instructor_id === userId
                );
                const tokensToDisplay = userTokens.length > 0 ? userTokens : sectionShareTokens;
                return tokensToDisplay.map((sectionToken) => {
                  const sectionUrl = `${window.location.origin}/quiz/${sectionToken.share_token}`;
                  return (
                    <div key={sectionToken.id || sectionToken.section_id} className="bg-white p-4 rounded-lg border border-gray-200">
                      <p className="text-sm font-semibold text-gray-700 mb-2">
                        {sectionToken.sections?.name || sectionToken.section_id}
                      </p>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={sectionUrl}
                          readOnly
                          className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-mono text-sm"
                        />
                        <button
                          onClick={() => copyToClipboard(sectionUrl)}
                          className="bg-brand-gold hover:bg-brand-gold-dark hover:brightness-95 hover:shadow-lg active:brightness-90 text-brand-navy px-4 py-2 rounded-lg font-semibold transition-all text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
                        >
                          Copy Link
                        </button>
                      </div>
                      <p className="text-xs text-gray-600">
                        <strong>Section Share Code:</strong>{" "}
                        <code className="bg-gray-100 px-2 py-1 rounded font-mono">{sectionToken.share_token}</code>
                      </p>
                    </div>
                  );
                });
              })()}
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
              <p className="text-sm text-yellow-800 mb-3">
                No section-specific share codes available. Make sure the quiz is assigned to sections.
              </p>
              {!isNotOwner && (
                <button
                  onClick={handleAutoShareWithSubjectSections}
                  disabled={autoSharing}
                  className="bg-brand-navy hover:bg-brand-indigo text-white px-4 py-2 rounded-lg font-semibold transition text-sm disabled:opacity-50"
                >
                  {autoSharing ? "Sharing..." : "Share with All Sections of This Subject"}
                </button>
              )}
            </div>
          )}
          
          {shareToken && (
            <p className="text-sm text-gray-600 mt-4 bg-white p-3 rounded border border-gray-200">
              <strong>General Quiz Code:</strong>{" "}
              <code className="bg-gray-100 px-2 py-1 rounded font-mono">{shareToken}</code>
              {" "}(for legacy access)
            </p>
          )}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-bold text-brand-navy mb-4">
          Quiz Information
        </h2>

        {isLocked && (
          <div className="mb-4 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700 font-semibold">
            {isPublished
              ? "This quiz is published and cannot be edited."
              : isReviewLocked
                ? "This quiz is in the review process and cannot be edited until the review is finished. If revisions are requested, use “Edit & Resubmit” from My Submissions."
                : "This quiz belongs to another instructor and is read-only."}
          </div>
        )}
        <div className="space-y-4">
          {quizId && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="text-sm text-gray-700">
                <span className="font-semibold">Assigned sections:</span>{" "}
                {(() => {
                  const names = availableSections
                    .filter((s) => selectedSectionIds.includes(s.id) && s.instructor_id === userId)
                    .map((s) => s.description || s.name);
                  return names.length > 0 ? names.join(", ") : "None";
                })()}
              </div>
              <button
                type="button"
                onClick={() => setShowSectionModal(true)}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-brand-navy text-white hover:bg-brand-indigo transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/40"
              >
                {isLocked ? "View Sections" : "Manage Sections"}
              </button>
            </div>
          )}
          <div>
            <label htmlFor="quiz-edit-title" className="block text-sm font-semibold text-gray-700 mb-2">
              Quiz Title *
            </label>
            <input
              id="quiz-edit-title"
              required
              type="text"
              value={quizTitle}
              onChange={(e) => { setQuizTitle(e.target.value); markDirty(); }}
              placeholder="e.g., Biology Chapter 5 Test"
              disabled={isLocked}
              className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold focus:ring-opacity-20 ${isLocked ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
            />
          </div>
          <div>
            <label htmlFor="quiz-edit-description" className="block text-sm font-semibold text-gray-700 mb-2">
              Description / Instructions
            </label>
            <textarea
              id="quiz-edit-description"
              value={quizDescription}
              onChange={(e) => { setQuizDescription(e.target.value); markDirty(); }}
              placeholder="Enter quiz instructions or description for students (optional)"
              disabled={isLocked}
              rows={3}
              className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold focus:ring-opacity-20 resize-none ${isLocked ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
            />
          </div>
          <div>
            <label htmlFor="quiz-edit-duration" className="block text-sm font-semibold text-gray-700 mb-2">
              Duration (minutes)
            </label>
            <input
              id="quiz-edit-duration"
              type="number"
              min="1"
              value={quizDuration}
              onChange={(e) => { setQuizDuration(e.target.value); markDirty(); }}
              placeholder="Leave blank for unlimited"
              disabled={isLocked}
              className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold focus:ring-opacity-20 ${isLocked ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Quiz Visibility Setting
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-colors ${
                  isPrivate
                    ? "border-brand-navy bg-brand-navy/5 ring-1 ring-brand-navy"
                    : "border-gray-200 hover:bg-gray-50"
                } ${isLocked ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <input
                  type="radio"
                  name="edit_quiz_visibility"
                  checked={isPrivate}
                  disabled={isLocked}
                  onChange={() => {
                    setIsPrivate(true);
                    markDirty();
                  }}
                  className="mt-0.5 text-brand-navy focus:ring-brand-navy"
                />
                <div>
                  <span className="block text-sm font-bold text-gray-800 flex items-center gap-1.5">
                    Private <span className="text-[10px] font-normal px-1.5 py-0.2 bg-gray-200 text-gray-700 rounded">Default</span>
                  </span>
                  <span className="block text-xs text-gray-500 mt-0.5">
                    Only you can see this quiz and its questions. Hidden from all other instructors and Question Bank.
                  </span>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-colors ${
                  !isPrivate
                    ? "border-brand-navy bg-brand-navy/5 ring-1 ring-brand-navy"
                    : "border-gray-200 hover:bg-gray-50"
                } ${isLocked ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <input
                  type="radio"
                  name="edit_quiz_visibility"
                  checked={!isPrivate}
                  disabled={isLocked}
                  onChange={() => {
                    setIsPrivate(false);
                    markDirty();
                  }}
                  className="mt-0.5 text-brand-navy focus:ring-brand-navy"
                />
                <div>
                  <span className="block text-sm font-bold text-gray-800 flex items-center gap-1.5">
                    Public
                  </span>
                  <span className="block text-xs text-gray-500 mt-0.5">
                    Visible to other instructors. Questions are available in the Question Bank for shared subjects.
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>

      {showAddQuestionPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div
            ref={addQuestionTrapRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-question-count-title"
            className="bg-white rounded-xl shadow-2xl p-6 w-[340px]"
          >
            <h3 id="add-question-count-title" className="text-lg font-bold text-brand-navy mb-4">
              How many questions do you want to add?
            </h3>
            <input
              type="number"
              min="1"
              max="100"
              value={questionCount}
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "") {
                  setQuestionCount("");
                } else {
                  setQuestionCount(Math.max(1, Math.min(100, parseInt(val) || 1)));
                }
              }}
              onBlur={() => {
                if (questionCount === "" || questionCount < 1) setQuestionCount(1);
              }}
              autoFocus
              aria-label="Number of questions to add"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-brand-navy focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 transition-all mb-4 text-center text-lg"
            />
            <div className="flex gap-3">
              <button
                onClick={() => addMultipleQuestions(parseInt(questionCount) || 1)}
                className="flex-1 bg-brand-gold text-brand-navy py-2 rounded-lg font-semibold hover:bg-brand-gold-dark hover:brightness-95 hover:shadow-lg active:brightness-90 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
              >
                Add {parseInt(questionCount) || 1} Question{(parseInt(questionCount) || 1) > 1 ? "s" : ""}
              </button>
              <button
                onClick={() => setShowAddQuestionPopup(false)}
                className="flex-1 bg-gray-300 text-gray-800 py-2 rounded-lg font-semibold hover:bg-gray-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section Selection Modal */}
      {showSectionModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              handleCloseSectionModal();
            }}
          />
          <div
            ref={sectionTrapRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="section-modal-title"
            className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4"
          >
            <h3 id="section-modal-title" className="text-lg font-bold text-gray-800 mb-1">
              Assign to Sections
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Select which of your sections this quiz should appear in.
            </p>

            {mySections.length === 0 ? (
              <div className="text-sm text-gray-500 py-4 text-center">
                No sections available. Add a section from the Subjects page first.
              </div>
            ) : (
              <>
                {/* Select All (only your own sections; shared sections are kept) */}
                <label className="flex items-center gap-3 border-b border-gray-200 pb-3 mb-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mySections.every((s) => selectedSectionIds.includes(s.id))}
                    onChange={(e) => {
                      const myIds = mySections.map((s) => s.id);
                      if (e.target.checked) {
                        setSelectedSectionIds([...new Set([...selectedSectionIds, ...myIds])]);
                      } else {
                        setSelectedSectionIds(selectedSectionIds.filter((id) => !myIds.includes(id)));
                      }
                    }}
                    disabled={isLocked}
                    className="form-checkbox h-4 w-4 text-brand-gold-dark border-gray-300 rounded"
                  />
                  <span className="text-sm font-semibold text-gray-800">
                    Select All
                  </span>
                  <span className="ml-auto text-xs text-gray-400">
                    {mySections.filter((s) => selectedSectionIds.includes(s.id)).length}/{mySections.length}
                  </span>
                </label>

                {/* Section List */}
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {mySections.map((sec) => (
                    <label
                      key={sec.id}
                      className={`flex items-center gap-3 border p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedSectionIds.includes(sec.id)
                          ? "border-brand-gold bg-brand-gold/10"
                          : "border-gray-200 hover:bg-gray-50"
                      } ${isLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedSectionIds.includes(sec.id)}
                        onChange={(e) => {
                          if (e.target.checked)
                            setSelectedSectionIds([
                              ...selectedSectionIds,
                              sec.id,
                            ]);
                          else
                            setSelectedSectionIds(
                              selectedSectionIds.filter((id) => id !== sec.id),
                            );
                        }}
                        disabled={isLocked}
                        className="form-checkbox h-4 w-4 text-brand-gold-dark border-gray-300 rounded"
                      />
                      <div>
                        <span className="block text-sm font-medium text-gray-800">
                          {sec.name || "Untitled Section"}
                        </span>
                        {sec.description && (
                          <span className="block text-xs text-gray-500">
                            {sec.description}
                          </span>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </>
            )}

            <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-200">
              <button
                onClick={() => handleCloseSectionModal()}
                disabled={saveSectionsLoading}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saveSectionsLoading ? "Saving..." : isLocked ? "Close" : "Save Sections"}
              </button>
            </div>
          </div>
        </div>
      )}

      {quizId && (parentQuizId || isPublished) && (
        <QuizRevisionHistory parentQuizId={parentQuizId} currentQuizId={quizId} />
      )}

      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        {restoredFromSnapshot > 0 && (
          <div className="mb-6 p-4 rounded-lg bg-brand-navy/5 border border-brand-navy/20">
            <div className="flex items-start gap-3">
              <div className="mt-0.5"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-brand-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg></div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-brand-navy">
                  {restoredFromSnapshot} questions restored from review snapshot
                </p>
                <p className="text-sm text-brand-navy/80 mt-1">
                  These questions were recovered from your last submitted review
                  (because the original question rows were no longer in the database).
                  <span className="font-semibold">
                    Click "Save as Draft" below to permanently save them back to the
                    database.
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mb-6 gap-4">
          <div>
            <h2 className="text-xl font-bold text-brand-navy">
              Questions ({questions.length})
            </h2>
            {totalPages > 1 && (
              <p className="text-xs text-gray-500 mt-1">
                Showing {startIndex + 1}–{Math.min(endIndex, questions.length)} of {questions.length} questions (Page {validCurrentPage} of {totalPages})
              </p>
            )}
          </div>
          {!isLocked && (
            <div className="flex flex-wrap items-center gap-2">
              <label
                className="bg-brand-navy hover:bg-brand-navy/90 text-white px-3.5 py-2 rounded-lg font-semibold transition-colors text-sm flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="Import questions directly from a CSV or JSON file"
              >
                
                <span>Import CSV</span>
                <input
                  type="file"
                  accept=".csv,.json"
                  onChange={handleImportCSVFile}
                  className="hidden"
                />
              </label>
              <button
                onClick={() => {
                  setBankTargetIndex(null);
                  setShowBankModal(true);
                }}
                className="bg-brand-navy hover:bg-brand-navy/90 text-white px-3.5 py-2 rounded-lg font-semibold transition-colors text-sm flex items-center gap-1.5 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/40"
                title="Import a new question from Question Bank"
              >
                
                <span>From Question Bank</span>
              </button>
              <button
                onClick={addQuestion}
                className="bg-brand-gold text-brand-navy px-4 py-2 rounded-lg font-semibold hover:bg-brand-gold-dark hover:brightness-95 hover:shadow-lg active:brightness-90 transition-all text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
              >
                + Add Question
              </button>
            </div>
          )}
        </div>

        {questions.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg space-y-4">
            <p className="text-gray-500 font-medium">No questions added yet</p>
            {!isLocked && (
              <div className="flex flex-wrap items-center justify-center gap-3">
                <label
                  className="bg-brand-navy hover:bg-brand-navy/90 text-white px-4 py-2 rounded-lg font-semibold transition-colors text-sm flex items-center gap-1.5 cursor-pointer shadow-xs focus-within:ring-2 focus-within:ring-brand-navy/40"
                >
                  
                  <span>Import CSV</span>
                  <input
                    type="file"
                    accept=".csv,.json"
                    onChange={handleImportCSVFile}
                    className="hidden"
                  />
                </label>
                <button
                  onClick={() => {
                    setBankTargetIndex(null);
                    setShowBankModal(true);
                  }}
                  className="bg-brand-navy hover:bg-brand-navy/90 text-white px-4 py-2 rounded-lg font-semibold transition-colors text-sm flex items-center gap-1.5 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/40"
                >
                  
                  <span>From Question Bank</span>
                </button>
                <button
                  onClick={addQuestion}
                  className="bg-brand-gold text-brand-navy px-5 py-2 rounded-lg font-semibold hover:bg-brand-gold-dark hover:brightness-95 hover:shadow-lg active:brightness-90 transition-all text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
                >
                  Add First Question
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-6">
            {paginatedQuestions.map((question, index) => {
              const idx = startIndex + index;
              return (
              <div
                key={`${question.id}-${idx}`}
                className="border-2 border-gray-200 rounded-lg p-5 hover:border-brand-gold/60 transition-colors"
              >
                {/* Collapsible header */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={expandedQuestions.has(question.id)}
                  aria-label={`Question ${idx + 1}: ${question.text || "Untitled question"}`}
                  className="flex justify-between items-center cursor-pointer select-none rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
                  onClick={() => toggleQuestion(question.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleQuestion(question.id);
                    }
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${expandedQuestions.has(question.id) ? "rotate-90" : ""}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <h3 className="text-lg font-semibold text-gray-800 truncate">
                      {idx + 1}. {question.text || <span className="text-gray-400 italic">Untitled question</span>}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    {(() => {
                      const gadEval = analyzeGADQuestion(question.text || "", question.options);
                      return (
                        <>
                          {gadEval.isGadThematic && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-300 flex items-center gap-1" title="Contains Gender and Development (GAD) Theme">
                              GAD Theme
                            </span>
                          )}
                          {gadEval.hasGenderBias && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-brand-navy/80 border border-amber-300 flex items-center gap-1" title={`Gender bias detected: "${gadEval.biasMatches[0]?.matchedText}"`}>
                               Gender Bias
                            </span>
                          )}
                        </>
                      );
                    })()}
                    {question.ai_generated && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-brand-navy/10 text-brand-navy border border-brand-navy/20" title="Generated with AI Assistance">
                        AI Generated
                      </span>
                    )}
                    {question.ai_revised && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-brand-indigo/10 text-brand-indigo border border-brand-indigo/20" title="Revised with AI Assistance">
                        AI Revised
                      </span>
                    )}
                    <span className="text-xs text-gray-400 uppercase">{question.type === "mcq" ? "MCQ" : question.type === "true_false" ? "T/F" : question.type}</span>
                    <span className="text-xs bg-brand-navy/10 text-brand-navy px-2 py-0.5 rounded-full font-semibold">{question.points || 1} pt{(question.points || 1) > 1 ? "s" : ""}</span>
                  </div>
                </div>

                {/* Expandable content */}
                {expandedQuestions.has(question.id) && (
                <div className="mt-4">
                <div className="flex justify-end gap-2 mb-4">
                    {!isLocked && (
                      <>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            setBankTargetIndex(idx);
                            setShowBankModal(true);
                          }}
                          className="text-brand-navy hover:text-amber-950 text-xs font-bold px-3 py-1 bg-amber-100 hover:bg-amber-200 rounded-lg border border-amber-300 transition-colors flex items-center gap-1"
                          title={`Import question from Question Bank into Question #${idx + 1}`}
                        >
                          
                          <span>Replace from Question Bank</span>
                        </button>
                        <button
                          onClick={async (e) => {
                            e.preventDefault();
                            const confirmed = await confirm({
                              title: "Archive Question",
                              message:
                                "Archive this question? It is removed from this quiz right away and kept in the Question Bank's Archived tab, where you can restore it.",
                              confirmText: "Archive",
                              cancelText: "Cancel",
                              variant: "warning",
                            });
                            if (confirmed) {
                              archiveQuestion(question.id).catch((err) =>
                                console.error("Failed to archive question:", err),
                              );
                            }
                          }}
                          disabled={deletingQuestionId === question.id}
                          className={`${deletingQuestionId === question.id ? "text-gray-400 cursor-not-allowed" : "text-yellow-600 hover:text-yellow-800"} text-sm font-semibold px-3 py-1 transition-colors`}
                        >
                          {deletingQuestionId === question.id
                            ? "..."
                            : <><svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>Archive</>}
                        </button>
                        <button
                          onClick={async (e) => {
                            e.preventDefault();
                            const confirmed = await confirm({
                              title: "Remove Question",
                              message: isUnsavedQuestionId(question.id)
                                ? "Remove this question from the quiz?"
                                : "Remove this question from the quiz? It will be permanently deleted when you save the quiz. To keep it for later, use Archive instead.",
                              confirmText: "Remove",
                              cancelText: "Cancel",
                              variant: "danger",
                            });
                            if (confirmed) {
                              // Deletion of saved questions happens on save, like every other edit
                              removeQuestionLocally(question.id);
                            }
                          }}
                          className="text-red-600 hover:text-red-800 text-sm font-semibold px-3 py-1 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          Remove
                        </button>
                      </>
                    )}
                  </div>

                <div className="mb-4">
                  <label htmlFor={`question-text-${question.id}`} className="block text-sm font-semibold text-gray-700 mb-2">
                    Question Text *
                  </label>
                  <textarea
                    id={`question-text-${question.id}`}
                    value={question.text}
                    onChange={(e) =>
                      updateQuestion(question.id, "text", e.target.value)
                    }
                    placeholder="Enter the question"
                    rows="2"
                    disabled={isLocked}
                    className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold focus:ring-opacity-20 ${isLocked ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
                  />
                  {/* Real-time Gender-Fair Language / Bias Detection & Quick Fix */}
                  {(() => {
                    const biasMatches = detectGenderBias(question.text || "");
                    if (biasMatches.length === 0) return null;
                    const first = biasMatches[0];
                    return (
                      <div className="mt-2.5 p-3 bg-brand-navy/5 border border-brand-navy/20 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-brand-navy animate-fadeIn">
                        <div className="flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-brand-navy shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                          <span>
                            <strong>Gender-Fair Language Notice:</strong> The term <em className="font-semibold underline">"{first.matchedText}"</em> is gender-biased. Suggested: <strong className="font-bold underline">"{first.neutral}"</strong> (CSC/PCW Standard)
                          </span>
                        </div>
                        {!isLocked && (
                          <button
                            type="button"
                            onClick={() => {
                              const corrected = replaceGenderBiasedTerm(question.text, first.matchedText, first.neutral);
                              updateQuestion(question.id, "text", corrected);
                              notify.success(`Replaced "${first.matchedText}" with "${first.neutral}"!`);
                            }}
                            className="shrink-0 px-3 py-1 bg-brand-navy hover:bg-brand-navy/90 text-white font-bold rounded-md transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
                            title={`Replace "${first.matchedText}" with "${first.neutral}"`}
                          >
                            <span>Quick Fix</span>
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {question.type === "mcq" && (
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Options *
                    </label>
                    <div className="space-y-2">
                      {question.options.map((option, optIdx) => (
                        <div key={optIdx} className="flex gap-2 items-center">
                          <input
                            type="radio"
                            name={`correct-${question.id}`}
                            aria-label={`Mark option ${String.fromCharCode(97 + optIdx)} as the correct answer`}
                            checked={question.correctAnswer === optIdx}
                            disabled={isLocked}
                            onChange={() =>
                              !isLocked &&
                              updateQuestion(
                                question.id,
                                "correctAnswer",
                                optIdx,
                              )
                            }
                            className={`mt-0.5 ${isLocked ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
                          />
                          <span className="text-sm font-semibold text-gray-500 w-5">
                            ({String.fromCharCode(97 + optIdx)})
                          </span>
                          <input
                            type="text"
                            value={option}
                            aria-label={`Option ${String.fromCharCode(97 + optIdx)}`}
                            disabled={isLocked}
                            onChange={(e) =>
                              updateOption(question.id, optIdx, e.target.value)
                            }
                            placeholder={`Option ${String.fromCharCode(97 + optIdx)}`}
                            className={`flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-gold ${isLocked ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
                          />
                          {!isLocked && question.options.length > 2 && (
                            <button
                              type="button"
                              onClick={() => removeOption(question.id, optIdx)}
                              aria-label={`Remove option ${String.fromCharCode(97 + optIdx)}`}
                              className="text-red-500 hover:text-red-700 px-3 py-2"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {!isLocked && (
                      <button
                        onClick={() => addOption(question.id)}
                        className="text-sm text-brand-gold-dark font-semibold mt-2 hover:text-brand-navy"
                      >
                        + Add Option
                      </button>
                    )}
                  </div>
                )}

                {question.type === "true_false" && (
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Correct Answer *
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name={`tf-${question.id}`}
                          checked={question.correctAnswer === 0}
                          disabled={isLocked}
                          onChange={() =>
                            !isLocked &&
                            updateQuestion(question.id, "correctAnswer", 0)
                          }
                          className={`mr-2 ${isLocked ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
                        />
                        <span className="text-gray-700">True</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name={`tf-${question.id}`}
                          checked={question.correctAnswer === 1}
                          disabled={isLocked}
                          onChange={() =>
                            !isLocked &&
                            updateQuestion(question.id, "correctAnswer", 1)
                          }
                          className={`mr-2 ${isLocked ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
                        />
                        <span className="text-gray-700">False</span>
                      </label>
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor={`question-points-${question.id}`} className="block text-sm font-semibold text-gray-700 mb-2">
                    Points
                  </label>
                  <input
                    id={`question-points-${question.id}`}
                    type="number"
                    value={question.points}
                    disabled={isLocked}
                    onChange={(e) =>
                      updateQuestion(
                        question.id,
                        "points",
                        Math.max(1, parseInt(e.target.value) || 1),
                      )
                    }
                    min="1"
                    className={`w-20 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-gold ${isLocked ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
                  />
                </div>
                </div>
                )}
              </div>
            );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-200 mt-6">
              <p className="text-sm text-gray-500 font-medium">
                Showing {startIndex + 1}–{Math.min(endIndex, questions.length)} of {questions.length} questions
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={validCurrentPage === 1}
                  aria-label="Previous question page"
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
                >
                  Prev
                </button>
                {renderPageButtons()}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={validCurrentPage === totalPages}
                  aria-label="Next question page"
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
                >
                  Next
                </button>
              </div>
            </div>
          )}
          </>
        )}
      </div>

      {/* Action Bar */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4 mb-8">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Primary Actions */}
          {!isLocked && (
            <>
              <button
                onClick={() => handleSaveQuiz(false, false)}
                disabled={saving}
                className="bg-brand-gold hover:bg-brand-gold-dark hover:brightness-95 hover:shadow-lg active:brightness-90 text-brand-navy px-5 py-2.5 rounded-lg font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                {saving ? "Saving..." : "Save as Draft"}
              </button>

              <button
                onClick={async () => {
                  const saveRes = await handleSaveQuiz(false, false);
                  if (saveRes?.error) {
                    notify.error(`Please fix questions before submitting for review: ${saveRes.error}`);
                    return;
                  }
                  setShowAnalysisModal(true);
                }}
                disabled={
                  saving || questions.length === 0 || questions.some((q) => !(q.text || "").trim())
                }
                className="bg-brand-navy hover:bg-brand-indigo text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/40"
                title={
                  questions.length === 0
                    ? "Add questions first"
                    : "Analyze questions with AI and submit for review"
                }
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Submit for Review
              </button>
            </>
          )}

          {/* Right-aligned navigation */}
          <div className="ml-auto flex items-center gap-3">
            {!isLocked && (
              <span className="text-xs text-gray-400" aria-live="polite">
                {hasUnsavedChanges
                  ? "Unsaved changes"
                  : lastSaved
                    ? `Saved at ${lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                    : ""}
              </span>
            )}
            <button
              onClick={leaveEditor}
              aria-label={quizId ? "Close the quiz editor" : "Cancel quiz creation"}
              className="px-4 py-2.5 rounded-lg font-semibold text-sm border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
            >
              {quizId ? "Close" : "Cancel"}
            </button>
          </div>
        </div>
      </div>

      </div>{/* end .p-6 wrapper */}

      {/* Bloom's Taxonomy Analysis Modal */}
      {showAnalysisModal && (
        <QuizAnalysisResults
          quizId={quizId || "draft"}
          quizTitle={quizTitle}
          questions={questions.filter((q) => (q.text || "").trim())}
          instructorId={userId}
          previousSubmissionId={location.state?.revisionOfSubmissionId || null}
          initialReviewerId={location.state?.assignedReviewerId || null}
          onBeforeSubmitReview={async () => {
            return await handleSaveQuiz(false, false);
          }}
          onClose={async () => {
            setShowAnalysisModal(false);
            // A successful submission locks the quiz; refresh the review status
            if (quizId) {
              const { data: latestSub } = await supabase
                .from("quiz_analysis_submissions")
                .select("status")
                .eq("quiz_id", quizId)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();
              setReviewStatus(latestSub?.status || null);
            }
          }}
        />
      )}

      {/* Archive Subject Selection Modal */}
      <SelectSubjectModal
        isOpen={showSubjectModal}
        onClose={() => {
          setShowSubjectModal(false);
          setQuestionToArchive(null);
        }}
        onConfirm={handleArchiveWithSubject}
        questionText={questionToArchive?.text}
      />

      {/* Question Bank Import Modal */}
      <ImportQuestionBankModal
        isOpen={showBankModal}
        onClose={() => setShowBankModal(false)}
        onSelectQuestion={handleImportFromBank}
        onSelectQuestions={handleImportManyFromBank}
        targetQuestionNumber={bankTargetIndex !== null ? bankTargetIndex + 1 : null}
        currentQuizQuestions={questions}
        currentSubjectIds={[
          ...new Set(
            availableSections
              .filter((s) => selectedSectionIds.includes(s.id))
              .map((s) => s.subject_id)
              .filter(Boolean),
          ),
        ]}
      />
    </div>
  );
};




