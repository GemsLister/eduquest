import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { notify } from "../../utils/notify.jsx";
import { parseCSV } from "../../utils/csvParser.js";
import { useConfirm } from "../../components/ui/ConfirmModal.jsx";
import { supabase } from "../../supabaseClient.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useQuestionBank } from "../../hooks/questionHook/useQuestionBank.jsx";
import { analyzeGADQuestion } from "../../services/gadAnalysisService.js";
import { ReuseQuestionModal } from "../../components/ReuseQuestionModal.jsx";

const ITEMS_PER_PAGE = 10;

export const QuestionBank = () => {
  const navigate = useNavigate();
  const { quizId } = useParams();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState("active");
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [importing, setImporting] = useState(false);
  const [sortBy, setSortBy] = useState("newest");
  // typeFilter removed — only MCQ type exists
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [bulkSelected, setBulkSelected] = useState(new Set());
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);
  const [showQuizDropdown, setShowQuizDropdown] = useState(false);
  const [importProcessing, setImportProcessing] = useState(false);

  // Reuse Modal State
  const [showReuseModal, setShowReuseModal] = useState(false);
  const [questionsToReuse, setQuestionsToReuse] = useState([]);

  // Import Config Modal State
  const [showImportConfigModal, setShowImportConfigModal] = useState(false);
  const [pendingImportQuestions, setPendingImportQuestions] = useState([]);
  const [pendingImportFileName, setPendingImportFileName] = useState("");
  const [importTargetSubjectId, setImportTargetSubjectId] = useState("");
  const [importTargetQuizId, setImportTargetQuizId] = useState("");
  const [importIsPrivate, setImportIsPrivate] = useState(true);

  // Subject, Quiz, and GAD filter state
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [selectedQuizIdFilter, setSelectedQuizIdFilter] = useState(null);
  const [ownershipFilter, setOwnershipFilter] = useState("all");
  const [gadFilter, setGadFilter] = useState("all");
  const [subjects, setSubjects] = useState([]);
  const [quizzesFromSubject, setQuizzesFromSubject] = useState([]);
  const [allInstructorQuizzes, setAllInstructorQuizzes] = useState([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);

  const {
    activeQuestions,
    archivedQuestions,
    loading,
    archiveQuestion,
    restoreQuestion,
    deleteQuestion,
    addToBank,
    addBulkToBank,
    fetchQuestions,
  } = useQuestionBank();

  const [addFormStep, setAddFormStep] = useState(1); // 1: Select Count, 2: Question Builder
  const [questionCountInput, setQuestionCountInput] = useState(1);
  const [batchSubjectId, setBatchSubjectId] = useState("");
  const [batchQuizId, setBatchQuizId] = useState("");
  const [batchIsPrivate, setBatchIsPrivate] = useState(true);
  const [questionsBatch, setQuestionsBatch] = useState([]);
  const [activeBatchIndex, setActiveBatchIndex] = useState(0);
  const [addingBatchProcessing, setAddingBatchProcessing] = useState(false);

  const formatSubjectLabel = (subject) => {
    if (!subject) return "";
    const name = String(subject.name || "").trim();
    const code = String(
      subject.code || subject.description || "",
    ).trim();

    // Keep subject code visible even when subject names are very long.
    if (!code) {
      return name.length > 64 ? `${name.slice(0, 61)}...` : name;
    }

    const maxTotal = 64;
    const reservedForCode = Math.min(code.length + 1, 20);
    const maxNameLength = Math.max(16, maxTotal - reservedForCode);
    const shortName =
      name.length > maxNameLength
        ? `${name.slice(0, maxNameLength - 3)}...`
        : name;

    return `${shortName} ${code}`.trim();
  };

  // Reset page & bulk selection when tab/search/filter changes
  useEffect(() => {
    setCurrentPage(1);
    setBulkSelected(new Set());
  }, [activeTab, searchTerm, sortBy, selectedSubjectId, selectedQuizIdFilter, ownershipFilter, gadFilter]);

  // Fetch subjects on mount
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        setSubjectsLoading(true);
        if (!user) {
          setSubjectsLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("subjects")
          .select("id, name, code, description")
          .or("is_archived.is.null,is_archived.eq.false")
          .order("name", { ascending: true });

        if (error) throw error;
        setSubjects(data || []);
      } catch (err) {
        console.error("Error fetching subjects:", err);
        setSubjects([]);
      } finally {
        setSubjectsLoading(false);
      }
    };

    fetchSubjects();
  }, []);

  // Read URL params and set initial subject
  useEffect(() => {
    const subjectId = searchParams.get("subjectId");
    if (subjectId) {
      setSelectedSubjectId(subjectId);
    }
  }, [searchParams]);

  // Fetch all quizzes owned by current instructor and public subject quizzes
  useEffect(() => {
    if (!user) return;

    const fetchAllQuizzes = async () => {
      try {
        // 1. Fetch ALL quizzes created by current instructor
        const { data: ownQuizzes, error: ownErr } = await supabase
          .from("quizzes")
          .select("id, title, is_archived, is_published, is_private, instructor_id, subject_id, section_id")
          .eq("instructor_id", user.id)
          .order("title", { ascending: true });

        if (ownErr) throw ownErr;

        const uniqueMap = new Map();
        (ownQuizzes || []).forEach((q) => {
          if (q.is_archived !== true) uniqueMap.set(q.id, q);
        });

        // 2. Also fetch public quizzes from co-instructors
        const { data: publicQuizzes } = await supabase
          .from("quizzes")
          .select("id, title, is_archived, is_published, is_private, instructor_id, subject_id, section_id")
          .neq("instructor_id", user.id)
          .eq("is_private", false)
          .order("title", { ascending: true });

        (publicQuizzes || []).forEach((q) => {
          if (q.is_archived !== true && !uniqueMap.has(q.id)) uniqueMap.set(q.id, q);
        });

        // 3. Resolve section-to-subject mappings for quizzes assigned via sections
        const { data: junctionRows } = await supabase
          .from("quiz_sections")
          .select("quiz_id, section_id, sections(subject_id)");

        const quizSubjectMap = new Map();
        (junctionRows || []).forEach((j) => {
          if (j.quiz_id && j.sections?.subject_id) {
            quizSubjectMap.set(String(j.quiz_id), String(j.sections.subject_id));
          }
        });

        const resolvedQuizzes = Array.from(uniqueMap.values()).map((q) => {
          const resolvedSubjId = q.subject_id || quizSubjectMap.get(String(q.id)) || null;
          return {
            ...q,
            subject_id: resolvedSubjId,
          };
        });

        setAllInstructorQuizzes(resolvedQuizzes);

        // Filter for current selectedSubjectId if specified
        if (selectedSubjectId) {
          const subjStr = String(selectedSubjectId);
          const filtered = resolvedQuizzes.filter((q) => !q.subject_id || String(q.subject_id) === subjStr);
          setQuizzesFromSubject(filtered);
        } else {
          setQuizzesFromSubject(resolvedQuizzes);
        }
      } catch (err) {
        console.error("Error fetching instructor quizzes:", err);
        setAllInstructorQuizzes([]);
        setQuizzesFromSubject([]);
      }
    };

    fetchAllQuizzes();
  }, [user, selectedSubjectId]);

  // Helper function to check if question matches GAD criteria
  const isQuestionGad = (q) => {
    if (!q) return false;
    if (q.is_gad === true) return true;
    const auto = analyzeGADQuestion(q.text || "", q.options || []);
    return Boolean(auto.isGad);
  };

  // Helper to check if a question is owned by current instructor
  const isQuestionOwn = (q) => {
    if (!user) return false;
    if (q.is_own === true) return true;
    if (q.quizzes?.instructor_id === user.id) return true;
    if (q.instructor_id === user.id) return true;
    return false;
  };

  // Helper to check if a question is Private
  const isQuestionPrivate = (q) => {
    if (q.is_private === false || q.blooms_level === "public") return false;
    if (q.is_private === true || q.blooms_level === "private") return true;
    if (q.quizzes && q.quizzes.is_private === false) return false;
    return false;
  };

  // Filter questions
  const filterQuestions = (questions) => {
    let filteredList = questions;

    // Apply Ownership & Privacy Filter
    if (ownershipFilter === "my_private") {
      // Show Private questions owned by current instructor
      filteredList = filteredList.filter((q) => isQuestionOwn(q) && isQuestionPrivate(q));
    } else if (ownershipFilter === "my_public" || ownershipFilter === "mine") {
      // Show Public questions owned by current instructor
      filteredList = filteredList.filter((q) => isQuestionOwn(q) && !isQuestionPrivate(q));
    } else if (ownershipFilter === "others_public") {
      // Show Public questions shared by other instructors
      filteredList = filteredList.filter((q) => !isQuestionOwn(q));
    }

    // Apply GAD Filter
    if (gadFilter === "gad_only") {
      filteredList = filteredList.filter((q) => isQuestionGad(q));
    } else if (gadFilter === "non_gad") {
      filteredList = filteredList.filter((q) => !isQuestionGad(q));
    }

    // Handle quiz dropdown selection (Subject to Quiz filter)
    if (selectedQuizIdFilter) {
      const selectedQuizObj = quizzesFromSubject.find((q) => String(q.id) === String(selectedQuizIdFilter));
      const targetQuizTitle = selectedQuizObj?.title?.trim().toLowerCase();
      const targetQuizIds = new Set([
        String(selectedQuizIdFilter),
        selectedQuizObj?.parent_quiz_id ? String(selectedQuizObj.parent_quiz_id) : null
      ].filter(Boolean));

      filteredList = filteredList.filter((q) => {
        const directMatch = targetQuizIds.has(String(q.quiz_id));
        const dedupeMatch = q.all_quiz_ids?.some((id) => targetQuizIds.has(String(id)));
        const parentMatch =
          q.all_parent_quiz_ids?.some((id) => targetQuizIds.has(String(id))) ||
          (q.quizzes?.parent_quiz_id && targetQuizIds.has(String(q.quizzes.parent_quiz_id))) ||
          (q.parent_quiz_id && targetQuizIds.has(String(q.parent_quiz_id)));
        const titleMatch = targetQuizTitle && q.quizzes?.title?.trim().toLowerCase() === targetQuizTitle;

        return directMatch || dedupeMatch || parentMatch || titleMatch;
      });
    } else if (selectedSubjectId) {
      // If subject selected but no quiz yet, show questions from any quiz in this subject
      // AND standalone questions assigned to this subject
      const quizIdsInSubject = new Set(
        quizzesFromSubject.flatMap((q) => [
          String(q.id),
          q.parent_quiz_id ? String(q.parent_quiz_id) : null
        ]).filter(Boolean)
      );
      const subjectIdStr = String(selectedSubjectId);
      
      filteredList = filteredList.filter((q) => {
        // Include standalone questions assigned to this subject
        const standaloneMatch = q.quiz_id === null && String(q.subject_id) === subjectIdStr;
        
        // Include questions from quizzes in this subject
        let quizMatch = false;
        if (quizIdsInSubject.size > 0) {
          const directMatch = quizIdsInSubject.has(String(q.quiz_id));
          const dedupeMatch = q.all_quiz_ids?.some((id) => quizIdsInSubject.has(String(id)));
          const parentMatch =
            q.all_parent_quiz_ids?.some((id) => quizIdsInSubject.has(String(id))) ||
            (q.quizzes?.parent_quiz_id && quizIdsInSubject.has(String(q.quizzes.parent_quiz_id)));
          quizMatch = directMatch || dedupeMatch || parentMatch;
        }
        
        return standaloneMatch || quizMatch;
      });
    } else if (quizId) {
      // URL-based import mode: show questions NOT from this quiz
      const quizIdStr = String(quizId);
      const currentQuizTexts = new Set(
        activeQuestions
          .filter((q) => {
            const directMatch = String(q.quiz_id) === quizIdStr;
            const dedupeMatch = q.all_quiz_ids?.some(
              (id) => String(id) === quizIdStr,
            );
            return directMatch || dedupeMatch;
          })
          .map((q) => q.text?.toLowerCase().trim()),
      );
      filteredList = filteredList.filter(
        (q) =>
          String(q.quiz_id) !== quizIdStr &&
          !q.all_quiz_ids?.some((id) => String(id) === quizIdStr) &&
          !currentQuizTexts.has(q.text?.toLowerCase().trim()),
      );
    }

    if (searchTerm) {
      filteredList = filteredList.filter(
        (q) =>
          q.text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          q.quizzes?.title?.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    // Sort
    filteredList = [...filteredList].sort((a, b) => {
      switch (sortBy) {
        case "oldest":
          return new Date(a.created_at || 0) - new Date(b.created_at || 0);
        case "points-high":
          return (b.points || 0) - (a.points || 0);
        case "points-low":
          return (a.points || 0) - (b.points || 0);
        case "quiz":
          return (a.quizzes?.title || "").localeCompare(b.quizzes?.title || "");
        case "newest":
        default:
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      }
    });

    return filteredList;
  };

  const allFiltered =
    activeTab === "active"
      ? filterQuestions(activeQuestions)
      : activeTab === "archived"
        ? filterQuestions(archivedQuestions)
        : filterQuestions(activeQuestions);

  // Pagination
  const totalPages = Math.max(
    1,
    Math.ceil(allFiltered.length / ITEMS_PER_PAGE),
  );
  const displayedQuestions = allFiltered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  // Stats
  const totalCount = activeQuestions.length + archivedQuestions.length;

  // Import select all
  const selectAll =
    displayedQuestions.length > 0 &&
    selectedQuestions.length === allFiltered.length;

  const handleSelectAllToggle = () => {
    if (selectAll) {
      setSelectedQuestions([]);
    } else {
      setSelectedQuestions([...allFiltered]);
    }
  };

  // Bulk select helpers
  const bulkSelectAll =
    displayedQuestions.length > 0 &&
    displayedQuestions.every((q) => bulkSelected.has(q.id));

  const handleBulkSelectAllToggle = () => {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (bulkSelectAll) {
        displayedQuestions.forEach((q) => next.delete(q.id));
      } else {
        displayedQuestions.forEach((q) => next.add(q.id));
      }
      return next;
    });
  };

  const toggleBulkSelect = (id) => {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkArchive = async () => {
    const confirmed = await confirm({
      title: "Archive Questions",
      message: `Are you sure you want to archive ${bulkSelected.size} question(s)?`,
      confirmText: "Archive",
      cancelText: "Cancel",
      variant: "warning",
    });
    if (confirmed) {
      for (const id of bulkSelected) {
        await archiveQuestion(id);
      }
      setBulkSelected(new Set());
      notify.success(`Archived ${bulkSelected.size} question(s)`);
    }
  };

  const handleBulkRestore = async () => {
    const confirmed = await confirm({
      title: "Restore Questions",
      message: `Are you sure you want to restore ${bulkSelected.size} question(s)?`,
      confirmText: "Restore",
      cancelText: "Cancel",
      variant: "info",
    });
    if (confirmed) {
      for (const id of bulkSelected) {
        await restoreQuestion(id);
      }
      setBulkSelected(new Set());
      notify.success(`Restored ${bulkSelected.size} question(s)`);
    }
  };

  const handleBulkDelete = async () => {
    const confirmed = await confirm({
      title: "Remove Questions Permanently",
      message: `Are you sure you want to permanently remove ${bulkSelected.size} question(s)? This cannot be undone.`,
      confirmText: "Remove",
      cancelText: "Cancel",
      variant: "danger",
    });
    if (confirmed) {
      let deleted = 0;
      let blocked = 0;
      for (const id of bulkSelected) {
        const result = await deleteQuestion(id);
        if (result.success) {
          deleted++;
        } else {
          blocked++;
          notify.error(result.error);
        }
      }
      setBulkSelected(new Set());
      if (deleted > 0) notify.success(`Removed ${deleted} question(s)`);
      if (blocked > 0 && deleted === 0)
        notify.info("No questions were removed. Archive them instead.");
    }
  };

  // Toggle expand
  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Open Reuse Modal with validation
  const handleOpenReuseModal = (questions) => {
    const targetList = Array.isArray(questions) ? questions : [questions];
    if (targetList.length === 0) {
      notify.warning("No questions selected to reuse.");
      return;
    }

    // Validate subject consistency across selected questions if multiple
    const subjectIds = new Set(
      targetList.map(
        (q) => q.subject_id || q.quizzes?.subject_id || q.subjects?.id || q.sections?.subject_id
      ).filter(Boolean)
    );

    if (subjectIds.size > 1) {
      notify.warning(
        "All selected questions must belong to the same subject to be reused together. Please filter by subject first."
      );
      return;
    }

    setQuestionsToReuse(targetList);
    setShowReuseModal(true);
  };

  // Open Add Question Form with Step 1 (Question Count Selector)
  const handleOpenAddForm = () => {
    setQuestionCountInput(1);
    setAddFormStep(1);
    setBatchSubjectId(selectedSubjectId || (subjects.length > 0 ? subjects[0].id : ""));
    setBatchQuizId(selectedQuizIdFilter || "");
    setBatchIsPrivate(true);
    setQuestionsBatch([
      {
        text: "",
        type: "mcq",
        options: ["", "", "", ""],
        correctAnswer: 0,
        points: 1,
      },
    ]);
    setActiveBatchIndex(0);
    setShowAddForm(true);
  };

  const handleProceedToQuestionBuilder = () => {
    const count = parseInt(questionCountInput) || 1;
    const finalCount = Math.max(1, Math.min(50, count));

    setQuestionsBatch((prev) => {
      const newArr = [];
      for (let i = 0; i < finalCount; i++) {
        if (prev[i]) {
          newArr.push(prev[i]);
        } else {
          newArr.push({
            text: "",
            type: "mcq",
            options: ["", "", "", ""],
            correctAnswer: 0,
            points: 1,
          });
        }
      }
      return newArr;
    });

    setActiveBatchIndex(0);
    setAddFormStep(2);
  };

  const handleAddQuestionToBatch = () => {
    setQuestionsBatch((prev) => [
      ...prev,
      {
        text: "",
        type: "mcq",
        options: ["", "", "", ""],
        correctAnswer: 0,
        points: 1,
      },
    ]);
    setActiveBatchIndex(questionsBatch.length);
  };

  const handleRemoveQuestionFromBatch = (indexToRemove) => {
    if (questionsBatch.length <= 1) {
      notify.warning("At least one question is required.");
      return;
    }
    setQuestionsBatch((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    setActiveBatchIndex((prev) => Math.max(0, Math.min(prev, questionsBatch.length - 2)));
  };

  const handleUpdateBatchQuestion = (index, field, value) => {
    setQuestionsBatch((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    );
  };

  const handleUpdateBatchOption = (qIdx, optIdx, val) => {
    setQuestionsBatch((prev) =>
      prev.map((q, idx) => {
        if (idx !== qIdx) return q;
        const newOpts = [...q.options];
        newOpts[optIdx] = val;
        return { ...q, options: newOpts };
      })
    );
  };

  const handleAddOptionToBatchQuestion = (qIdx) => {
    setQuestionsBatch((prev) =>
      prev.map((q, idx) => {
        if (idx !== qIdx) return q;
        return { ...q, options: [...q.options, ""] };
      })
    );
  };

  const handleRemoveOptionFromBatchQuestion = (qIdx, optIdx) => {
    setQuestionsBatch((prev) =>
      prev.map((q, idx) => {
        if (idx !== qIdx) return q;
        if (q.options.length <= 2) {
          notify.warning("Minimum 2 options required");
          return q;
        }
        const newOpts = q.options.filter((_, i) => i !== optIdx);
        const newCorrect = q.correctAnswer >= newOpts.length ? 0 : q.correctAnswer;
        return { ...q, options: newOpts, correctAnswer: newCorrect };
      })
    );
  };

  const handleSaveBatchToBank = async () => {
    if (!batchSubjectId) {
      notify.warning("Please select a subject to assign questions to.");
      return;
    }

    for (let i = 0; i < questionsBatch.length; i++) {
      const q = questionsBatch[i];
      if (!q.text || !q.text.trim()) {
        setActiveBatchIndex(i);
        notify.warning(`Question #${i + 1} text is required.`);
        return;
      }
      if (q.type === "mcq" && (q.options || []).some((o) => !o.trim())) {
        setActiveBatchIndex(i);
        notify.warning(`All options for Question #${i + 1} must be filled out.`);
        return;
      }
    }

    setAddingBatchProcessing(true);
    try {
      const preparedArray = questionsBatch.map((q) => {
        const correctAnswer =
          q.type === "mcq"
            ? q.options[q.correctAnswer] || q.correctAnswer
            : q.correctAnswer;

        return {
          text: q.text.trim(),
          type: q.type || "mcq",
          options: q.type === "mcq" ? q.options.filter((opt) => opt.trim()) : null,
          correct_answer: correctAnswer,
          points: q.points || 1,
          is_private: batchIsPrivate,
        };
      });

      const res = await addBulkToBank(
        preparedArray,
        null,
        null,
        batchSubjectId,
        batchIsPrivate,
        batchQuizId || null
      );

      if (res.success) {
        const targetQuizObj = allInstructorQuizzes.find((q) => String(q.id) === String(batchQuizId));
        const quizMsg = targetQuizObj ? ` into quiz "${targetQuizObj.title}"` : "";
        notify.success(
          `Successfully created ${preparedArray.length} ${
            batchIsPrivate ? "Private" : "Public"
          } question(s)${quizMsg}!`
        );

        setShowAddForm(false);

        // Auto-focus filters
        setSelectedSubjectId(batchSubjectId);
        if (batchQuizId) {
          setSelectedQuizIdFilter(batchQuizId);
        } else {
          setSelectedQuizIdFilter(null);
        }
        setSearchTerm("");
        setOwnershipFilter(batchIsPrivate ? "my_private" : "my_public");
        setActiveTab("active");

        await fetchQuestions();
      } else {
        notify.error("Error creating questions: " + res.error);
      }
    } catch (err) {
      console.error("Error creating questions:", err);
      notify.error("Failed to create questions: " + err.message);
    } finally {
      setAddingBatchProcessing(false);
    }
  };

  // Import to quiz
  const handleImportToQuiz = async () => {
    if (!quizId) {
      notify.warning("No quiz selected for import");
      return;
    }
    if (selectedQuestions.length === 0) {
      notify.warning("Please select at least one question to import");
      return;
    }
    setImporting(true);
    try {
      const { data: existingQuestions } = await supabase
        .from("questions")
        .select("id")
        .eq("quiz_id", quizId);

      let orderIndex = existingQuestions?.length || 0;

      for (const q of selectedQuestions) {
        const payload = {
          quiz_id: quizId,
          type: q.type,
          text: q.text,
          options: q.options,
          correct_answer: q.correct_answer,
          points: q.points,
          auto_answer: true, // Auto-answer flag for imported questions
        };
        let { error } = await supabase.from("questions").insert(payload);
        if (error && (error.code === "42703" || error.message?.includes("auto_answer"))) {
          delete payload.auto_answer;
          const retry = await supabase.from("questions").insert(payload);
          error = retry.error;
        }
        if (error) throw error;
        orderIndex++;
      }

      try {
        const { data: allQuestions, error: qsFetchErr } = await supabase
          .from("questions")
          .select("id, created_at")
          .eq("quiz_id", quizId)
          .order("created_at", { ascending: true });

        if (!qsFetchErr && allQuestions && allQuestions.length > 0) {
          await supabase
            .from("quiz_questions")
            .delete()
            .eq("quiz_id", quizId);

          const junctionRows = allQuestions.map((q, idx) => ({
            quiz_id: quizId,
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
        }
      } catch (junctionSyncErr) {
        console.warn(
          "quiz_questions sync skipped (table may not exist yet):",
          junctionSyncErr,
        );
      }

      notify.success(
        `Successfully imported ${selectedQuestions.length} question(s) with correct answers to the quiz!`,
      );
      setSelectedQuestions([]);
      navigate(`/instructor-dashboard/instructor-quiz/${quizId}`);
    } catch (error) {
      console.error("Error importing questions:", error);
      notify.error("Error importing questions: " + error.message);
    } finally {
      setImporting(false);
    }
  };

  // ---------------- Export Functions ----------------
  const getExportFilename = (ext = "json") => {
    const dateStr = new Date().toISOString().slice(0, 10);
    const subjectObj = subjects.find((s) => String(s.id) === String(selectedSubjectId));
    const subjectPrefix = subjectObj
      ? (subjectObj.code || subjectObj.name || "").replace(/[^a-zA-Z0-9]/g, "_")
      : "";
    const filterTag =
      ownershipFilter === "my_private"
        ? "private"
        : ownershipFilter === "mine"
        ? "public"
        : ownershipFilter === "others_public"
        ? "shared"
        : "all";

    const parts = ["question-bank"];
    if (subjectPrefix) parts.push(subjectPrefix);
    parts.push(filterTag);
    parts.push(dateStr);

    return `${parts.join("-")}.${ext}`;
  };

  const getQuestionsToExport = () => {
    // Respects current activeTab, selectedSubjectId, selectedQuizIdFilter, ownershipFilter, and searchTerm
    if (bulkSelected.size > 0) {
      return allFiltered.filter((q) => bulkSelected.has(q.id));
    }
    return allFiltered;
  };

  const handleExportJSON = () => {
    const questions = getQuestionsToExport();
    if (questions.length === 0) {
      notify.warning("No questions to export for the selected filter/subject.");
      return;
    }
    const exportData = {
      questions: questions.map((q) => ({
        text: q.text,
        type: q.type || "mcq",
        options: q.options,
        correct_answer: q.correct_answer,
        points: q.points || 1,
        creator_name: q.creator_name || null,
        subject_name: q.quizzes?.subjects?.name || q.subjects?.name || q.subject_name || null,
      })),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = getExportFilename("json");
    a.click();
    URL.revokeObjectURL(url);
    notify.success(`Exported ${questions.length} question(s) as JSON!`);
  };

  const handleExportCSV = () => {
    const questions = getQuestionsToExport();
    if (questions.length === 0) {
      notify.warning("No questions to export for the selected filter/subject.");
      return;
    }
    const headers = [
      "text",
      "type",
      "points",
      "correct_answer",
      "option_1",
      "option_2",
      "option_3",
      "option_4",
      "option_5",
      "option_6",
      "creator_name",
      "subject_name",
    ];
    const rows = questions.map((q) => {
      const opts = q.options || [];
      const correctIdx =
        typeof q.correct_answer === "number"
          ? q.correct_answer
          : opts.indexOf(q.correct_answer);
      const correctLetter =
        correctIdx >= 0
          ? String.fromCharCode(65 + correctIdx)
          : q.correct_answer;
      const subjectName =
        q.quizzes?.subjects?.name || q.subjects?.name || q.subject_name || "";

      const optCols = Array(6).fill('""');
      opts.forEach((o, i) => {
        if (i < 6) optCols[i] = `"${(o || "").replace(/"/g, '""')}"`;
      });

      return [
        `"${(q.text || "").replace(/"/g, '""')}"`,
        q.type || "mcq",
        q.points || 1,
        correctLetter,
        ...optCols,
        `"${(q.creator_name || "").replace(/"/g, '""')}"`,
        `"${(subjectName || "").replace(/"/g, '""')}"`,
      ];
    });
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = getExportFilename("csv");
    a.click();
    URL.revokeObjectURL(url);
    notify.success(`Exported ${questions.length} question(s) as CSV!`);
  };

  // ---------------- Import Functions ----------------
  const processImport = async (parsedQuestions, fileName = "") => {
    if (!parsedQuestions || parsedQuestions.length === 0) {
      notify.warning("No questions found in file");
      return;
    }
    try {
      const preparedQuestions = [];
      for (const rawQ of parsedQuestions) {
        const text = rawQ.text || rawQ.question || rawQ.Question || rawQ.question_text || rawQ["question text"];
        if (!text || String(text).trim() === "") continue;

        const type = (rawQ.type || rawQ.Type || "mcq").toString().toLowerCase();
        const points = parseInt(rawQ.points || rawQ.Points || rawQ.weight || 1) || 1;

        // Collect options
        let options = [];
        if (Array.isArray(rawQ.options)) options = rawQ.options.filter(o => o !== null && o !== undefined && o !== "");
        else if (Array.isArray(rawQ.Options)) options = rawQ.Options.filter(o => o !== null && o !== undefined && o !== "");
        else {
          for (let i = 1; i <= 6; i++) {
            const opt = rawQ[`option_${i}`] || rawQ[`Option ${i}`] || rawQ[`Option${i}`] || rawQ[String.fromCharCode(64 + i)];
            if (opt !== null && opt !== undefined && String(opt).trim() !== "") options.push(String(opt).trim());
          }
        }
        if (type === "mcq" && options.length < 2) options = ["", ""];

        // Determine correct answer
        let correctAnswer = rawQ.correct_answer ?? rawQ.correct ?? rawQ.CorrectAnswer ?? rawQ.answer ?? 0;
        if (typeof correctAnswer === "string") {
          if (/^[A-F]$/i.test(correctAnswer.trim())) {
            const idx = correctAnswer.toUpperCase().charCodeAt(0) - 65;
            correctAnswer = options[idx] || idx;
          } else if (!isNaN(parseInt(correctAnswer)) && parseInt(correctAnswer) < options.length) {
            const idx = parseInt(correctAnswer);
            correctAnswer = options[idx] || idx;
          }
        } else if (typeof correctAnswer === "number" && correctAnswer < options.length) {
          correctAnswer = options[correctAnswer] || correctAnswer;
        }

        preparedQuestions.push({
          text: text.toString().trim(),
          type,
          options,
          correct_answer: typeof correctAnswer === "string" ? correctAnswer : (options[correctAnswer] || correctAnswer),
          points,
        });
      }

      if (preparedQuestions.length === 0) {
        notify.warning("No valid questions found to import");
        return;
      }

      setPendingImportQuestions(preparedQuestions);
      setPendingImportFileName(fileName);
      setImportTargetSubjectId(selectedSubjectId || (subjects.length > 0 ? subjects[0].id : ""));
      setImportTargetQuizId(selectedQuizIdFilter || "");
      setImportIsPrivate(true);
      setShowImportConfigModal(true);
    } catch (err) {
      console.error("Import parsing error:", err);
      notify.error("Error processing file: " + err.message);
    }
  };

  const handleExecuteImport = async () => {
    if (!importTargetSubjectId) {
      notify.warning("Please select a subject to assign imported questions to.");
      return;
    }
    setImportProcessing(true);
    try {
      const res = await addBulkToBank(
        pendingImportQuestions,
        null,
        null,
        importTargetSubjectId,
        importIsPrivate,
        importTargetQuizId || null
      );
      if (res.success) {
        const targetQuizObj = quizzesFromSubject.find(q => String(q.id) === String(importTargetQuizId));
        const quizMsg = targetQuizObj ? ` into quiz "${targetQuizObj.title}"` : "";
        notify.success(
          `Successfully imported ${pendingImportQuestions.length} ${
            importIsPrivate ? "Private" : "Public"
          } question(s)${quizMsg}!`
        );
        setShowImportConfigModal(false);
        setPendingImportQuestions([]);

        // Automatically focus subject filter, quiz filter, reset search filter, set privacy filter to show imported questions immediately
        setSelectedSubjectId(importTargetSubjectId);
        if (importTargetQuizId) {
          setSelectedQuizIdFilter(importTargetQuizId);
        } else {
          setSelectedQuizIdFilter(null);
        }
        setSearchTerm("");
        setOwnershipFilter(importIsPrivate ? "my_private" : "my_public");
        setActiveTab("active");

        await fetchQuestions();
      } else {
        notify.error("Error importing questions: " + res.error);
      }
    } catch (err) {
      console.error("Import execution error:", err);
      notify.error("Error importing questions: " + err.message);
    } finally {
      setImportProcessing(false);
    }
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const content = ev.target?.result;
        let parsed = null;
        if (file.name.toLowerCase().endsWith(".json")) {
          parsed = JSON.parse(content);
          if (!Array.isArray(parsed)) {
            parsed = parsed.questions || parsed.data || parsed.items || [parsed];
          }
        } else if (file.name.toLowerCase().endsWith(".csv")) {
          parsed = parseCSV(content);
          if (parsed.length === 0) {
            notify.warning("CSV file must have a header row and at least one question row");
            return;
          }
        } else {
          notify.warning("Only .json and .csv files are supported");
          return;
        }
        await processImport(parsed, file.name);
      } catch (err) {
        console.error(err);
        notify.error("Failed to parse file: " + err.message);
      } finally {
        if (e.target) e.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  const parseCSVLine = (line) => {
    const result = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i+1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  };

  const toggleQuestionSelection = (question) => {
    setSelectedQuestions((prev) => {
      const isSelected = prev.some((q) => q.id === question.id);
      if (isSelected) return prev.filter((q) => q.id !== question.id);
      return [...prev, question];
    });
  };

  // Add/remove option
  const addOption = () => {
    setNewQuestion((prev) => ({
      ...prev,
      options: [...prev.options, ""],
    }));
  };

  const removeOption = (index) => {
    if (newQuestion.options.length <= 2) {
      notify.warning("Minimum 2 options required");
      return;
    }
    setNewQuestion((prev) => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index),
    }));
  };

  const updateOption = (index, value) => {
    setNewQuestion((prev) => ({
      ...prev,
      options: prev.options.map((opt, i) => (i === index ? value : opt)),
    }));
  };

  // Active filters for chips
  const activeFilters = [];
  if (searchTerm)
    activeFilters.push({
      key: "search",
      label: `"${searchTerm}"`,
      clear: () => setSearchTerm(""),
    });
  if (sortBy !== "newest") {
    const sortLabels = {
      oldest: "Oldest First",
      "points-high": "Points: High to Low",
      "points-low": "Points: Low to High",
      quiz: "By Quiz",
    };
    activeFilters.push({
      key: "sort",
      label: `Sort: ${sortLabels[sortBy]}`,
      clear: () => setSortBy("newest"),
    });
  }
  if (selectedSubjectId) {
    const subjectName =
      subjects.find((s) => s.id === selectedSubjectId)?.name || "Subject";
    activeFilters.push({
      key: "subject",
      label: `Subject: ${subjectName}`,
      clear: () => {
        setSelectedSubjectId(null);
        setSelectedQuizIdFilter(null);
      },
    });
  }
  if (selectedQuizIdFilter) {
    const quizTitle =
      quizzesFromSubject.find((q) => q.id === selectedQuizIdFilter)?.title ||
      "Quiz";
    activeFilters.push({
      key: "quiz",
      label: `Quiz: ${quizTitle}`,
      clear: () => setSelectedQuizIdFilter(null),
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand-gold"></div>
          <p className="mt-4 text-brand-navy font-semibold">
            Loading questions...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-authentic-white p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-brand-navy/10 hover:bg-brand-navy/20 text-brand-navy text-sm font-semibold rounded-lg transition-colors mb-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back
          </button>
          <h1 className="text-3xl font-bold text-brand-navy mb-2">
            Question Bank
          </h1>
          <p className="text-gray-600">
            {quizId
              ? "Select questions to import to your quiz"
              : "Archive and manage your questions for reuse"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label
            className="bg-white text-brand-navy border-2 border-brand-navy px-4 py-3 rounded-lg font-semibold hover:bg-brand-navy hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            style={{ display: importProcessing ? "none" : "inline-flex", alignItems: "center", gap: "0.5rem" }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {importProcessing ? "Importing..." : "Import"}
            <input
              type="file"
              accept=".json,.csv"
              onChange={handleImportFile}
              className="hidden"
              disabled={importProcessing}
            />
          </label>
          <button
            onClick={handleExportJSON}
            disabled={importProcessing}
            className="bg-white text-brand-navy border-2 border-brand-navy px-4 py-3 rounded-lg font-semibold hover:bg-brand-navy hover:text-white transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export JSON
          </button>
          <button
            onClick={handleExportCSV}
            disabled={importProcessing}
            className="bg-white text-brand-navy border-2 border-brand-navy px-4 py-3 rounded-lg font-semibold hover:bg-brand-navy hover:text-white transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
          <button
            onClick={handleOpenAddForm}
            className="bg-brand-gold text-brand-navy px-6 py-3 rounded-lg font-semibold hover:bg-brand-gold-dark transition-colors shadow-xs"
          >
            + Add to Bank
          </button>
        </div>
      </div>

      {/* 1. Stats Summary Bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-navy/10 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-brand-navy"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-brand-navy">{totalCount}</p>
            <p className="text-xs text-gray-500 font-medium">Total Questions</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-brand-navy">
              {activeQuestions.length}
            </p>
            <p className="text-xs text-gray-500 font-medium">Active</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-yellow-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
              />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-brand-navy">
              {archivedQuestions.length}
            </p>
            <p className="text-xs text-gray-500 font-medium">Archived</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab("active")}
          className={`px-6 py-3 font-semibold ${
            activeTab === "active"
              ? "text-brand-gold border-b-2 border-brand-gold"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Active Questions ({activeQuestions.length})
        </button>
        <button
          onClick={() => setActiveTab("archived")}
          className={`px-6 py-3 font-semibold ${
            activeTab === "archived"
              ? "text-brand-gold border-b-2 border-brand-gold"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Archived ({archivedQuestions.length})
        </button>
        {quizId && (
          <button
            onClick={() => setActiveTab("import")}
            className={`px-6 py-3 font-semibold ${
              activeTab === "import"
                ? "text-brand-gold border-b-2 border-brand-gold"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Import to Quiz ({selectedQuestions.length} selected)
          </button>
        )}
      </div>

      {/* Subject + Quiz + Ownership Filters */}
      <div className="flex flex-wrap gap-4 mb-4 items-center">
        {/* Ownership & Privacy Filter Buttons */}
        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={() => setOwnershipFilter("all")}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${
              ownershipFilter === "all"
                ? "bg-brand-navy text-white border-brand-navy shadow-xs"
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
            }`}
          >
            All Questions
          </button>
          <button
            type="button"
            onClick={() => setOwnershipFilter("my_private")}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all border flex items-center gap-1.5 ${
              ownershipFilter === "my_private"
                ? "bg-brand-navy text-white border-brand-navy shadow-xs"
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
            }`}
          >
            <span>🔒 Private Questions</span>
          </button>
          <button
            type="button"
            onClick={() => setOwnershipFilter("my_public")}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all border flex items-center gap-1.5 ${
              ownershipFilter === "my_public" || ownershipFilter === "mine"
                ? "bg-brand-navy text-white border-brand-navy shadow-xs"
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
            }`}
          >
            <span>🌐 Public Questions</span>
          </button>
          <button
            type="button"
            onClick={() => setOwnershipFilter("others_public")}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all border flex items-center gap-1.5 ${
              ownershipFilter === "others_public"
                ? "bg-brand-navy text-white border-brand-navy shadow-xs"
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
            }`}
          >
            <span>🤝 Shared Questions</span>
          </button>
          <button
            type="button"
            onClick={() => setGadFilter(gadFilter === "gad_only" ? "all" : "gad_only")}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all border flex items-center gap-1.5 ${
              gadFilter === "gad_only"
                ? "bg-brand-navy text-white border-brand-navy shadow-xs"
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
            }`}
          >
            <span>GAD Questions</span>
          </button>
        </div>

        {/* Subject Dropdown */}
        <select
          value={selectedSubjectId || ""}
          onChange={(e) => {
            const subjectId = e.target.value || null;
            setSelectedSubjectId(subjectId);
            setSelectedQuizIdFilter(null);
          }}
          className="px-4 py-2.5 border border-gray-300 rounded-full text-sm focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 min-w-[200px]"
          disabled={subjectsLoading}
        >
          <option value="">
            {subjectsLoading
              ? "Loading subjects..."
              : "-- Select Subject --"}
          </option>
          {subjects.length === 0 && !subjectsLoading && (
            <option disabled>No subjects found</option>
          )}
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {formatSubjectLabel(subject)}
            </option>
          ))}
        </select>

        {/* Quiz Dropdown */}
        <select
          value={selectedQuizIdFilter || ""}
          onChange={(e) => {
            const quizIdVal = e.target.value || null;
            setSelectedQuizIdFilter(quizIdVal);
            if (quizIdVal) {
              const selectedQuizObj = allInstructorQuizzes.find((q) => String(q.id) === String(quizIdVal));
              if (selectedQuizObj?.subject_id && !selectedSubjectId) {
                setSelectedSubjectId(selectedQuizObj.subject_id);
              }
            }
          }}
          className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 min-w-[220px]"
        >
          <option value="">-- Select Quiz --</option>
          {(selectedSubjectId ? quizzesFromSubject : allInstructorQuizzes).length === 0 ? (
            <option disabled>No quizzes found</option>
          ) : (
            (selectedSubjectId ? quizzesFromSubject : allInstructorQuizzes).map((quiz) => (
              <option key={quiz.id} value={quiz.id}>
                {quiz.title}
              </option>
            ))
          )}
        </select>

        {/* Search bar */}
        <div className="flex-1 relative">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search questions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-full focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
          />
        </div>

        {/* Sort Button */}
        <div className="relative">
          <button
            onClick={() => setShowSortDropdown(!showSortDropdown)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-full text-sm font-semibold text-gray-600 hover:border-brand-gold transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
              />
            </svg>
            Sort
          </button>
          {showSortDropdown && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowSortDropdown(false)}
              />
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                {[
                  { value: "newest", label: "Newest First" },
                  { value: "oldest", label: "Oldest First" },
                  { value: "points-high", label: "Points: High to Low" },
                  { value: "points-low", label: "Points: Low to High" },
                  { value: "quiz", label: "By Quiz Name" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setSortBy(opt.value);
                      setShowSortDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-brand-gold/10 transition-colors ${
                      sortBy === opt.value
                        ? "text-brand-gold font-semibold bg-brand-gold/5"
                        : "text-gray-700"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 8. Filter Chips */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {activeFilters.map((filter) => (
            <span
              key={filter.key}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-gold/10 text-brand-navy text-sm font-medium rounded-full"
            >
              {filter.label}
              <button
                onClick={filter.clear}
                className="hover:text-red-600 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </span>
          ))}
          <button
            onClick={() => {
              setSearchTerm("");
              setSortBy("newest");
              setSelectedSectionId(null);
              setSelectedQuizIdFilter(null);
            }}
            className="text-sm text-gray-500 hover:text-red-500 font-medium px-2 transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

      {/* 4. Bulk Actions Toolbar */}
      {activeTab !== "import" && bulkSelected.size > 0 && (
        <div className="mb-4 p-3 bg-brand-navy/5 border border-brand-navy/10 rounded-lg flex justify-between items-center">
          <div className="flex items-center gap-3">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={bulkSelectAll}
                onChange={handleBulkSelectAllToggle}
                className="mr-2 h-4 w-4 rounded"
              />
              <span className="text-brand-navy font-semibold text-sm">
                {bulkSelected.size} selected
              </span>
            </label>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const selectedList = allFiltered.filter((q) => bulkSelected.has(q.id));
                handleOpenReuseModal(selectedList);
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-gold text-brand-navy rounded-lg text-sm font-bold hover:bg-brand-gold-dark transition-colors shadow-2xs"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Reuse Selected ({bulkSelected.size})
            </button>
            {activeTab === "active" && (
              <button
                onClick={handleBulkArchive}
                className="flex items-center gap-1.5 px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-semibold hover:bg-yellow-600 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                  />
                </svg>
                Archive Selected
              </button>
            )}
            {activeTab === "archived" && (
              <>
                <button
                  onClick={handleBulkRestore}
                  className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Restore Selected
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Remove Selected
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Import Action Bar */}
      {activeTab === "import" && quizId && (
        <div className="mb-4 p-4 bg-brand-gold/10 border border-brand-gold/20 rounded-lg flex justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={handleSelectAllToggle}
                className="mr-2 h-5 w-5 rounded"
              />
              <span className="text-brand-navy font-semibold text-sm">
                Select All ({allFiltered.length})
              </span>
            </label>
            <span className="text-brand-navy/70 font-semibold text-sm">
              {selectedQuestions.length} / {allFiltered.length} selected
            </span>
          </div>
          <button
            onClick={handleImportToQuiz}
            disabled={importing || selectedQuestions.length === 0}
            className="bg-brand-gold text-brand-navy px-6 py-2 rounded-lg font-semibold hover:bg-brand-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing
              ? "Importing..."
              : `Import ${selectedQuestions.length} Questions`}
          </button>
        </div>
      )}

      {/* Questions List */}
      {allFiltered.length === 0 ? (
        /* 2. Empty State SVG */
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <div className="mx-auto w-20 h-20 bg-brand-navy/5 rounded-full flex items-center justify-center mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-10 w-10 text-brand-navy/30"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-brand-navy mb-1">
            {searchTerm ? "No questions match your search" : "No questions yet"}
          </h3>
          <p className="text-gray-500 text-sm max-w-sm mx-auto">
            {searchTerm
              ? "Try adjusting your search to find what you're looking for."
              : activeTab === "archived"
                ? "Archived questions will appear here. Archive questions from the Active tab to see them."
                : 'Start building your question bank by clicking the "+ Add to Bank" button above.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Bulk select all checkbox (non-import tabs) */}
          {activeTab !== "import" && (
            <div className="flex items-center px-2 py-1">
              <label className="flex items-center cursor-pointer text-sm text-gray-500">
                <input
                  type="checkbox"
                  checked={bulkSelectAll}
                  onChange={handleBulkSelectAllToggle}
                  className="mr-2 h-4 w-4 rounded"
                />
                Select all on this page
              </label>
            </div>
          )}

          {displayedQuestions.map((question) => {
            const isExpanded = expandedIds.has(question.id);
            const isImportSelected = selectedQuestions.some(
              (q) => q.id === question.id,
            );
            const isBulkChecked = bulkSelected.has(question.id);

            return (
              <div
                key={question.id}
                onClick={
                  activeTab === "import"
                    ? () => toggleQuestionSelection(question)
                    : undefined
                }
                className={`group transition-all bg-white rounded-xl overflow-hidden ${
                  activeTab === "import" ? "cursor-pointer " : ""
                }${
                  activeTab === "import" && isImportSelected
                    ? "border-2 border-brand-gold shadow-md ring-2 ring-brand-gold/20"
                    : "border border-gray-200 hover:border-brand-gold/40 hover:shadow-sm"
                }`}
              >
                {/* 3. Left border accent */}
                <div className="flex border-l-4 border-l-brand-navy">
                  {/* Bulk checkbox (non-import) */}
                  {activeTab !== "import" && (
                    <div className="flex items-start pt-4 pl-3">
                      <input
                        type="checkbox"
                        checked={isBulkChecked}
                        onChange={() => toggleBulkSelect(question.id)}
                        className="h-4 w-4 rounded cursor-pointer"
                      />
                    </div>
                  )}

                  {/* Import checkbox */}
                  {activeTab === "import" && (
                    <div className="flex items-start pt-4 pl-3">
                      <input
                        type="checkbox"
                        checked={isImportSelected}
                        onChange={() => {}}
                        className="h-5 w-5 rounded pointer-events-none"
                      />
                    </div>
                  )}

                  <div className="flex-1 p-4">
                    {/* Top metadata row */}
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-[10px] font-bold">
                        📖 {question.subject_name || question.subjects?.name || question.quizzes?.subjects?.name || "Unassigned Subject"}
                      </span>
                      {activeTab !== "import" && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenReuseModal(question);
                          }}
                          className="ml-auto px-3 py-1 bg-brand-gold text-brand-navy hover:bg-brand-gold-dark text-xs font-extrabold rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                          title="Reuse this question in a quiz"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                          </svg>
                          <span>Reuse</span>
                        </button>
                      )}
                      {question.quizzes?.title && (
                        <span className="text-xs text-gray-500 italic">
                          📝 Quiz: {question.quizzes.title}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {question.points} pt{question.points !== 1 ? "s" : ""}
                      </span>
                      {isQuestionGad(question) && (
                        <span
                          className="px-2 py-0.5 border rounded text-[10px] font-bold bg-brand-navy/5 text-brand-navy border-brand-navy/20 flex items-center gap-1"
                          title={analyzeGADQuestion(question.text || "", question.options || []).matchReason || "Gender and Development (GAD) / Gender-Fair Question"}
                        >
                          GAD
                        </span>
                      )}
                      {question.ai_generated && (
                        <span className="px-2 py-0.5 border rounded text-[10px] font-bold bg-brand-navy/5 text-brand-navy border-brand-navy/20">
                          AI Generated
                        </span>
                      )}
                      {question.ai_revised && (
                        <span className="px-2 py-0.5 border rounded text-[10px] font-bold bg-brand-indigo/10 text-brand-indigo border border-brand-indigo/20">
                          AI Revised
                        </span>
                      )}
                      {/* Privacy & Ownership Badge */}
                      {isQuestionOwn(question) ? (
                        isQuestionPrivate(question) ? (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-300 rounded-md text-[10px] font-extrabold flex items-center gap-1 shadow-2xs">
                            🔒 Private Question
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-[10px] font-extrabold flex items-center gap-1 shadow-2xs">
                            🌐 Public Question
                          </span>
                        )
                      ) : (
                        <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-md text-[10px] font-extrabold flex items-center gap-1 shadow-2xs">
                          🤝 Shared Question
                        </span>
                      )}
                      {question.creator_name && (
                        <span className="px-2 py-0.5 border rounded text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                          Owner: {question.creator_name}
                        </span>
                      )}
                    </div>

                    {/* Question text - clickable to expand */}
                    <button
                      onClick={(e) => {
                        if (activeTab !== "import") {
                          e.stopPropagation();
                          toggleExpand(question.id);
                        }
                      }}
                      className={`text-left w-full ${activeTab !== "import" ? "cursor-pointer" : ""}`}
                    >
                      <h3
                        className={`text-[15px] font-semibold text-gray-800 ${
                          !isExpanded && activeTab !== "import"
                            ? "line-clamp-2"
                            : ""
                        }`}
                      >
                        {question.text}
                      </h3>
                    </button>

                    {/* 7. Expandable options preview */}
                    {(isExpanded || activeTab === "import") &&
                      question.options && (
                        <div className="mt-3 space-y-1.5">
                          {question.options.map((opt, idx) => (
                            <div
                              key={idx}
                              className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg ${
                                opt === question.correct_answer
                                  ? "bg-green-50 text-green-700 font-semibold"
                                  : "text-gray-600"
                              }`}
                            >
                              <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-xs font-bold shrink-0">
                                {String.fromCharCode(65 + idx)}
                              </span>
                              {opt}
                              {opt === question.correct_answer && (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-4 w-4 ml-auto text-green-600 shrink-0"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2.5}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                    {/* Expand hint */}
                    {!isExpanded &&
                      activeTab !== "import" &&
                      question.options?.length > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(question.id);
                          }}
                          className="mt-2 text-xs text-gray-400 hover:text-brand-gold transition-colors flex items-center gap-1"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                          Show {question.options.length} options
                        </button>
                      )}
                    {isExpanded && activeTab !== "import" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(question.id);
                        }}
                        className="mt-2 text-xs text-gray-400 hover:text-brand-gold transition-colors flex items-center gap-1"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 15l7-7 7 7"
                          />
                        </svg>
                        Hide options
                      </button>
                    )}
                  </div>

                  {/* 10. Hover Card Actions */}
                  {activeTab === "active" && (
                    <div className="flex items-start gap-1 pt-4 pr-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => archiveQuestion(question.id)}
                        className="p-2 rounded-lg text-yellow-600 hover:bg-yellow-50 transition-colors"
                        title="Archive"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                          />
                        </svg>
                      </button>
                      {quizId && (
                        <button
                          onClick={() => {
                            setSelectedQuestions([question]);
                            setActiveTab("import");
                          }}
                          className="p-2 rounded-lg text-brand-navy hover:bg-brand-navy/10 transition-colors"
                          title="Import"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                  {activeTab === "archived" && (
                    <div className="flex items-start gap-1 pt-4 pr-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => restoreQuestion(question.id)}
                        className="p-2 rounded-lg text-green-600 hover:bg-green-50 transition-colors"
                        title="Restore"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={async () => {
                          const confirmed = await confirm({
                            title: "Remove Question Permanently",
                            message:
                              "Are you sure you want to permanently remove this question?",
                            confirmText: "Remove",
                            cancelText: "Cancel",
                            variant: "danger",
                          });
                          if (confirmed) {
                            const result = await deleteQuestion(question.id);
                            if (!result.success) notify.error(result.error);
                          }
                        }}
                        className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                        title="Remove permanently"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 6. Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
            {Math.min(currentPage * ITEMS_PER_PAGE, allFiltered.length)} of{" "}
            {allFiltered.length} questions
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 rounded-lg text-sm font-semibold transition-colors ${
                  currentPage === page
                    ? "bg-brand-navy text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Add Question Modal with Count Selector & Batch Builder */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200 flex flex-col">
            {/* Header */}
            <div className="bg-brand-navy text-white px-6 py-4 flex justify-between items-center shrink-0">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-gold block">
                  Question Bank Creator • Step {addFormStep} of 2
                </span>
                <h3 className="text-xl font-bold">
                  {addFormStep === 1
                    ? "Select How Many Questions to Create"
                    : `Create ${questionsBatch.length} Question${questionsBatch.length > 1 ? "s" : ""}`}
                </h3>
              </div>
              <button
                onClick={() => setShowAddForm(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-base transition-colors"
              >
                ✕
              </button>
            </div>

            {/* STEP 1: Question Count Selector */}
            {addFormStep === 1 && (
              <div className="p-8 space-y-6 overflow-y-auto">
                <div className="text-center max-w-md mx-auto space-y-2">
                  <div className="w-14 h-14 bg-brand-gold/15 text-brand-gold rounded-2xl flex items-center justify-center mx-auto text-2xl font-black mb-3">
                    ❓
                  </div>
                  <h4 className="text-lg font-bold text-slate-800">
                    How many questions would you like to create?
                  </h4>
                  <p className="text-xs text-slate-500 font-medium">
                    Choose a quick count or enter any custom quantity to build your questions together.
                  </p>
                </div>

                {/* Quick Presets */}
                <div className="grid grid-cols-5 gap-3 max-w-lg mx-auto">
                  {[1, 2, 3, 5, 10].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setQuestionCountInput(preset)}
                      className={`py-3 px-2 rounded-xl text-xs font-bold transition-all border text-center ${
                        parseInt(questionCountInput) === preset
                          ? "bg-brand-navy text-white border-brand-navy shadow-md ring-2 ring-brand-navy/20 scale-105"
                          : "bg-white text-slate-700 border-slate-200 hover:border-brand-gold hover:bg-amber-50/50"
                      }`}
                    >
                      <span className="block text-lg font-black">{preset}</span>
                      <span className="text-[10px] opacity-80 uppercase tracking-wider block font-semibold">
                        {preset === 1 ? "Question" : "Questions"}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Custom input */}
                <div className="max-w-xs mx-auto text-center">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                    Or Enter Custom Quantity:
                  </label>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQuestionCountInput((p) => Math.max(1, (parseInt(p) || 1) - 1))}
                      className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-lg transition-colors"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={questionCountInput}
                      onChange={(e) => setQuestionCountInput(e.target.value)}
                      className="w-24 px-3 py-2 bg-white border border-slate-300 rounded-xl text-center text-lg font-extrabold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-gold"
                    />
                    <button
                      type="button"
                      onClick={() => setQuestionCountInput((p) => Math.min(50, (parseInt(p) || 1) + 1))}
                      className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-lg transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 max-w-lg mx-auto">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleProceedToQuestionBuilder}
                    className="px-6 py-2.5 bg-brand-gold hover:bg-brand-gold-dark text-brand-navy text-xs font-extrabold rounded-xl transition-all shadow-xs flex items-center gap-2"
                  >
                    <span>Continue to Question Builder</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Multi-Question Form Builder */}
            {addFormStep === 2 && (
              <div className="flex flex-col flex-1 overflow-hidden">
                {/* Global Settings (Subject, Target Quiz, Privacy) */}
                <div className="p-5 bg-slate-50 border-b border-slate-200 shrink-0 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Subject Selector */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Assign to Subject <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={batchSubjectId}
                        onChange={(e) => {
                          setBatchSubjectId(e.target.value);
                          setBatchQuizId("");
                        }}
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-gold"
                      >
                        <option value="">-- Select Subject --</option>
                        {subjects.map((s) => (
                          <option key={s.id} value={s.id}>
                            {formatSubjectLabel(s)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Target Quiz Selector */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Target Quiz <span className="text-slate-400 font-normal lowercase">(optional)</span>
                      </label>
                      <select
                        value={batchQuizId}
                        onChange={(e) => {
                          const quizIdVal = e.target.value;
                          const selectedQuizObj = allInstructorQuizzes.find((q) => String(q.id) === String(quizIdVal));
                          setBatchQuizId(quizIdVal);
                          if (selectedQuizObj?.subject_id) {
                            setBatchSubjectId(selectedQuizObj.subject_id);
                          }
                        }}
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-gold"
                      >
                        <option value="">-- Standalone Question Bank (No Quiz Container) --</option>
                        {(batchSubjectId
                          ? allInstructorQuizzes.filter((q) => !q.subject_id || String(q.subject_id) === String(batchSubjectId))
                          : allInstructorQuizzes
                        ).map((quiz) => {
                          const subjObj = subjects.find((s) => String(s.id) === String(quiz.subject_id));
                          const subjTag = subjObj ? ` (${subjObj.code || subjObj.name})` : "";
                          return (
                            <option key={quiz.id} value={quiz.id}>
                              {quiz.title}{subjTag}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  {/* Visibility Toggles */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Question Visibility:
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setBatchIsPrivate(true)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                          batchIsPrivate
                            ? "bg-brand-navy text-white border-brand-navy shadow-2xs"
                            : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
                        }`}
                      >
                        🔒 Private
                      </button>
                      <button
                        type="button"
                        onClick={() => setBatchIsPrivate(false)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                          !batchIsPrivate
                            ? "bg-brand-navy text-white border-brand-navy shadow-2xs"
                            : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
                        }`}
                      >
                        🌐 Public
                      </button>
                    </div>
                  </div>
                </div>

                {/* Question Tabs Bar */}
                <div className="px-6 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center gap-2 overflow-x-auto shrink-0">
                  {questionsBatch.map((qItem, idx) => {
                    const isFilled = qItem.text.trim() !== "" && (qItem.options || []).every(o => o.trim() !== "");
                    const isActive = activeBatchIndex === idx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveBatchIndex(idx)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                          isActive
                            ? "bg-brand-gold text-brand-navy shadow-xs ring-2 ring-brand-gold/30"
                            : "bg-white text-slate-700 hover:bg-slate-200 border border-slate-300"
                        }`}
                      >
                        <span>Question #{idx + 1}</span>
                        {isFilled && <span className="text-[10px] text-green-700 font-black">✓</span>}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={handleAddQuestionToBatch}
                    className="px-3 py-1.5 bg-white text-brand-navy border border-dashed border-brand-navy/50 hover:bg-brand-navy/10 rounded-lg text-xs font-bold transition-colors shrink-0 flex items-center gap-1"
                  >
                    + Add Question
                  </button>
                </div>

                {/* Active Question Editor Body */}
                <div className="p-6 overflow-y-auto flex-1 space-y-5">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-brand-navy">
                      Question #{activeBatchIndex + 1} of {questionsBatch.length}
                    </span>
                    {questionsBatch.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveQuestionFromBatch(activeBatchIndex)}
                        className="text-xs font-bold text-red-600 hover:text-red-800 transition-colors flex items-center gap-1"
                      >
                        🗑 Remove Question #{activeBatchIndex + 1}
                      </button>
                    )}
                  </div>

                  {/* Question Text */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Question Text <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={questionsBatch[activeBatchIndex]?.text || ""}
                      onChange={(e) => handleUpdateBatchQuestion(activeBatchIndex, "text", e.target.value)}
                      placeholder={`Enter text for Question #${activeBatchIndex + 1}...`}
                      rows={3}
                      className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-gold"
                    />
                  </div>

                  {/* Options */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Multiple Choice Options & Correct Answer <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2.5">
                      {(questionsBatch[activeBatchIndex]?.options || []).map((option, optIdx) => (
                        <div key={optIdx} className="flex items-center gap-2">
                          <label className="flex items-center gap-2 cursor-pointer bg-slate-50 hover:bg-slate-100 px-3 py-2 rounded-xl border border-slate-200">
                            <input
                              type="radio"
                              name={`batch-correct-${activeBatchIndex}`}
                              checked={questionsBatch[activeBatchIndex]?.correctAnswer === optIdx}
                              onChange={() => handleUpdateBatchQuestion(activeBatchIndex, "correctAnswer", optIdx)}
                              className="accent-brand-navy w-4 h-4"
                            />
                            <span className="text-xs font-black text-slate-600">
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                          </label>
                          <input
                            type="text"
                            value={option}
                            onChange={(e) => handleUpdateBatchOption(activeBatchIndex, optIdx, e.target.value)}
                            placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                            className="flex-1 px-4 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-gold"
                          />
                          {(questionsBatch[activeBatchIndex]?.options || []).length > 2 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveOptionFromBatchQuestion(activeBatchIndex, optIdx)}
                              className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddOptionToBatchQuestion(activeBatchIndex)}
                      className="text-xs font-bold text-brand-gold hover:text-brand-gold-dark mt-2.5 transition-colors flex items-center gap-1"
                    >
                      + Add Option
                    </button>
                  </div>

                  {/* Points */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Points
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={questionsBatch[activeBatchIndex]?.points || 1}
                      onChange={(e) => handleUpdateBatchQuestion(activeBatchIndex, "points", parseInt(e.target.value) || 1)}
                      className="w-24 px-4 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-gold"
                    />
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setAddFormStep(1)}
                    className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1"
                  >
                    ← Back to Count Selection
                  </button>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveBatchToBank}
                      disabled={addingBatchProcessing}
                      className="px-6 py-2.5 bg-brand-gold hover:bg-brand-gold-dark text-brand-navy text-xs font-extrabold rounded-xl transition-all disabled:opacity-50 shadow-xs"
                    >
                      {addingBatchProcessing
                        ? "Saving Questions..."
                        : `Save All ${questionsBatch.length} Question${questionsBatch.length > 1 ? "s" : ""} to Bank`}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reuse Question Modal */}
      <ReuseQuestionModal
        isOpen={showReuseModal}
        onClose={() => setShowReuseModal(false)}
        questionsToReuse={questionsToReuse}
        user={user}
        defaultSubjectId={selectedSubjectId}
        onSuccess={() => {
          fetchQuestions();
          setBulkSelected(new Set());
        }}
        navigate={navigate}
      />

      {/* Import Settings & Privacy Modal */}
      {showImportConfigModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-brand-navy text-white px-6 py-4 flex justify-between items-center">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-gold block">
                  Question Bank Import
                </span>
                <h3 className="text-lg font-bold">
                  Import Settings ({pendingImportQuestions.length} Questions)
                </h3>
              </div>
              <button
                onClick={() => setShowImportConfigModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-base transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* File details summary */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center justify-between">
                <div>
                  <span className="text-slate-500 font-bold block mb-0.5">SOURCE FILE:</span>
                  <span className="font-extrabold text-slate-800">{pendingImportFileName || "Imported File"}</span>
                </div>
                <span className="px-2.5 py-1 bg-brand-gold/20 text-brand-navy font-black rounded-lg">
                  {pendingImportQuestions.length} Questions Found
                </span>
              </div>

              {/* Subject Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Target Subject <span className="text-red-500">*</span>
                </label>
                <select
                  value={importTargetSubjectId}
                  onChange={(e) => {
                    setImportTargetSubjectId(e.target.value);
                    setImportTargetQuizId("");
                  }}
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-gold"
                >
                  <option value="">-- Select Subject --</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {formatSubjectLabel(s)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Quiz Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Target Quiz <span className="text-slate-400 font-normal lowercase">(optional)</span>
                </label>
                <select
                  value={importTargetQuizId}
                  onChange={(e) => {
                    const quizIdVal = e.target.value;
                    const selectedQuizObj = allInstructorQuizzes.find((q) => String(q.id) === String(quizIdVal));
                    setImportTargetQuizId(quizIdVal);
                    if (selectedQuizObj?.subject_id) {
                      setImportTargetSubjectId(selectedQuizObj.subject_id);
                    }
                  }}
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-gold"
                >
                  <option value="">-- Standalone Question Bank (No Quiz Container) --</option>
                  {(importTargetSubjectId
                    ? allInstructorQuizzes.filter((q) => !q.subject_id || String(q.subject_id) === String(importTargetSubjectId))
                    : allInstructorQuizzes
                  ).map((quiz) => {
                    const subjObj = subjects.find((s) => String(s.id) === String(quiz.subject_id));
                    const subjTag = subjObj ? ` (${subjObj.code || subjObj.name})` : "";
                    return (
                      <option key={quiz.id} value={quiz.id}>
                        {quiz.title}{subjTag}
                      </option>
                    );
                  })}
                </select>
                <p className="text-[11px] text-slate-500 mt-1 font-medium">
                  Select one of your created quizzes to import all questions directly into that quiz container.
                </p>
              </div>

              {/* Question Visibility (Private vs Public) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Question Visibility <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setImportIsPrivate(true)}
                    className={`p-3.5 rounded-xl border text-left flex flex-col transition-all cursor-pointer ${
                      importIsPrivate === true
                        ? "border-brand-navy bg-brand-navy/5 shadow-2xs font-bold text-brand-navy ring-2 ring-brand-navy/20"
                        : "border-slate-200 hover:border-slate-300 text-slate-600 bg-white"
                    }`}
                  >
                    <span className="text-xs font-bold flex items-center gap-1.5 mb-1">
                      <span>🔒 Private Questions</span>
                    </span>
                    <span className="text-[11px] text-slate-500 font-normal leading-normal">
                      Only visible to you. Not shared with co-instructors.
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportIsPrivate(false)}
                    className={`p-3.5 rounded-xl border text-left flex flex-col transition-all cursor-pointer ${
                      importIsPrivate === false
                        ? "border-brand-navy bg-brand-navy/5 shadow-2xs font-bold text-brand-navy ring-2 ring-brand-navy/20"
                        : "border-slate-200 hover:border-slate-300 text-slate-600 bg-white"
                    }`}
                  >
                    <span className="text-xs font-bold flex items-center gap-1.5 mb-1">
                      <span>🌐 Public Questions</span>
                    </span>
                    <span className="text-[11px] text-slate-500 font-normal leading-normal">
                      Shared with co-instructors in the same subject for quiz reuse.
                    </span>
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowImportConfigModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={importProcessing || !importTargetSubjectId}
                  className="px-6 py-2.5 bg-brand-gold hover:bg-brand-gold-dark text-brand-navy text-xs font-extrabold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                >
                  {importProcessing ? "Importing..." : `Confirm & Import ${pendingImportQuestions.length} Questions`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

