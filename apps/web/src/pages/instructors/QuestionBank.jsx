import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useConfirm } from "../../components/ui/ConfirmModal.jsx";
import { supabase } from "../../supabaseClient.js";
import { useQuestionBank } from "../../hooks/questionHook/useQuestionBank.jsx";

const ITEMS_PER_PAGE = 10;

export const QuestionBank = () => {
  const navigate = useNavigate();
  const { quizId } = useParams();
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
  
  // Subject and Quiz filter state
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [selectedQuizIdFilter, setSelectedQuizIdFilter] = useState(null);
  const [sections, setSections] = useState([]);
  const [quizzesFromSection, setQuizzesFromSection] = useState([]);
  const [sectionsLoading, setSectionsLoading] = useState(true);
  
  // Cognitive level filter state
  const [selectedCognitiveLevel, setSelectedCognitiveLevel] = useState(null);

  const {
    activeQuestions,
    archivedQuestions,
    loading,
    archiveQuestion,
    restoreQuestion,
    deleteQuestion,
    addToBank,
    fetchQuestions,
  } = useQuestionBank();

  const [newQuestion, setNewQuestion] = useState({
    text: "",
    type: "mcq",
    options: ["", ""],
    correctAnswer: 0,
    points: 1,
    cognitiveLevel: "LOTS",
  });

  // Reset page & bulk selection when tab/search/filter changes
  useEffect(() => {
    setCurrentPage(1);
    setBulkSelected(new Set());
  }, [activeTab, searchTerm, sortBy, selectedSectionId, selectedQuizIdFilter, selectedCognitiveLevel]);

  // Fetch sections on mount
  useEffect(() => {
    const fetchSections = async () => {
      try {
        setSectionsLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setSectionsLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("sections")
          .select("id, section_name")
          .eq("instructor_id", user.id)
          .order("section_name", { ascending: true });

        if (error) {
          console.error("Error fetching sections:", error);
          setSections([]);
        } else {
          setSections(data || []);
        }
      } catch (err) {
        console.error("Error fetching sections:", err);
        setSections([]);
      } finally {
        setSectionsLoading(false);
      }
    };

    fetchSections();
  }, []);

  // Read URL params and set initial section
  useEffect(() => {
    const sectionId = searchParams.get("sectionId");
    if (sectionId) {
      setSelectedSectionId(sectionId);
    }
  }, [searchParams]);

  // Fetch quizzes when section changes
  useEffect(() => {
    if (!selectedSectionId) {
      setQuizzesFromSection([]);
      setSelectedQuizIdFilter(null);
      return;
    }

    const fetchQuizzes = async () => {
      try {
        const { data, error } = await supabase
          .from("quiz_sections")
          .select("quiz_id, quizzes(id, title)")
          .eq("section_id", selectedSectionId);

        if (error) throw error;

        const uniqueQuizzes = [];
        const seen = new Set();
        data?.forEach((qs) => {
          if (qs.quizzes && !seen.has(qs.quizzes.id)) {
            seen.add(qs.quizzes.id);
            uniqueQuizzes.push(qs.quizzes);
          }
        });

        setQuizzesFromSection(uniqueQuizzes);
      } catch (err) {
        console.error("Error fetching quizzes:", err);
        setQuizzesFromSection([]);
      }
    };

    fetchQuizzes();
  }, [selectedSectionId]);

  // Filter questions
  const filterQuestions = (questions) => {
    let filteredList = questions;

    // First, handle cognitive level filter
    if (selectedCognitiveLevel) {
      filteredList = filteredList.filter(
        (q) => q.cognitive_level === selectedCognitiveLevel,
      );
    }

    // Then, handle quiz dropdown selection (Subject → Quiz filter)
    if (selectedQuizIdFilter) {
      // Show only questions from the selected quiz
      filteredList = filteredList.filter(
        (q) => String(q.quiz_id) === String(selectedQuizIdFilter),
      );
    } else if (selectedSectionId) {
      // If section selected but no quiz yet, show questions from quizzes in this section
      const quizIdsInSection = quizzesFromSection.map(q => String(q.id));
      if (quizIdsInSection.length > 0) {
        filteredList = filteredList.filter(
          (q) => quizIdsInSection.includes(String(q.quiz_id)),
        );
      } else {
        // No quizzes in this section, show no questions
        filteredList = [];
      }
    } else if (quizId && activeTab === "import") {
      // URL-based import mode: show questions NOT from this quiz (only when in import tab)
      const currentQuizTexts = new Set(
        activeQuestions
          .filter((q) => String(q.quiz_id) === String(quizId))
          .map((q) => q.text?.toLowerCase().trim()),
      );
      filteredList = filteredList.filter(
        (q) =>
          String(q.quiz_id) !== String(quizId) &&
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
  const totalPages = Math.max(1, Math.ceil(allFiltered.length / ITEMS_PER_PAGE));
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
      toast.success(`Archived ${bulkSelected.size} question(s)`);
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
      toast.success(`Restored ${bulkSelected.size} question(s)`);
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
      for (const id of bulkSelected) {
        await deleteQuestion(id);
      }
      setBulkSelected(new Set());
      toast.success(`Removed ${bulkSelected.size} question(s)`);
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

  // Add to bank
  const handleAddToBank = async () => {
    if (!newQuestion.text.trim()) {
      toast.warning("Question text is required");
      return;
    }
    if (
      newQuestion.type === "mcq" &&
      newQuestion.options.some((o) => !o.trim())
    ) {
      toast.warning("All options must be filled");
      return;
    }
    const result = await addToBank(newQuestion);
    if (result.success) {
      toast.success("Question added to bank!");
      setNewQuestion({
        text: "",
        type: "mcq",
        options: ["", "", "", ""],
        correctAnswer: 0,
        points: 1,
        cognitiveLevel: "LOTS",
      });
      setShowAddForm(false);
    } else {
      toast.error("Error: " + result.error);
    }
  };

  // Import to quiz
  const handleImportToQuiz = async () => {
    if (!quizId) {
      toast.warning("No quiz selected for import");
      return;
    }
    if (selectedQuestions.length === 0) {
      toast.warning("Please select at least one question to import");
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
        const { error } = await supabase.from("questions").insert({
          quiz_id: quizId,
          type: q.type,
          text: q.text,
          options: q.options,
          correct_answer: q.correct_answer,
          points: q.points,
        });
        if (error) throw error;
        orderIndex++;
      }

      toast.success(
        `Successfully imported ${selectedQuestions.length} question(s) to the quiz!`,
      );
      setSelectedQuestions([]);
      navigate(`/instructor-dashboard/instructor-quiz/${quizId}`);
    } catch (error) {
      console.error("Error importing questions:", error);
      toast.error("Error importing questions: " + error.message);
    } finally {
      setImporting(false);
    }
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
      toast.warning("Minimum 2 options required");
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
  if (searchTerm) activeFilters.push({ key: "search", label: `"${searchTerm}"`, clear: () => setSearchTerm("") });
  if (sortBy !== "newest") {
    const sortLabels = { oldest: "Oldest First", "points-high": "Points: High→Low", "points-low": "Points: Low→High", quiz: "By Quiz" };
    activeFilters.push({ key: "sort", label: `Sort: ${sortLabels[sortBy]}`, clear: () => setSortBy("newest") });
  }
  if (selectedCognitiveLevel) {
    activeFilters.push({ key: "cognitive", label: `Level: ${selectedCognitiveLevel}`, clear: () => setSelectedCognitiveLevel(null) });
  }
  if (selectedSectionId) {
    const sectionName = sections.find(s => s.id === selectedSectionId)?.section_name || "Subject";
    activeFilters.push({ key: "section", label: `Subject: ${sectionName}`, clear: () => { setSelectedSectionId(null); setSelectedQuizIdFilter(null); } });
  }
  if (selectedQuizIdFilter) {
    const quizTitle = quizzesFromSection.find(q => q.id === selectedQuizIdFilter)?.title || "Quiz";
    activeFilters.push({ key: "quiz", label: `Quiz: ${quizTitle}`, clear: () => setSelectedQuizIdFilter(null) });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand-gold"></div>
          <p className="mt-4 text-brand-navy font-semibold">Loading questions...</p>
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
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            Back
          </button>
          <h1 className="text-3xl font-bold text-brand-navy mb-2">Question Bank</h1>
          <p className="text-gray-600">
            {quizId
              ? "Select questions to import to your quiz"
              : "Archive and manage your questions for reuse"}
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-brand-gold text-brand-navy px-6 py-3 rounded-lg font-semibold hover:bg-brand-gold-dark transition-colors"
        >
          + Add to Bank
        </button>
      </div>

      {/* 1. Stats Summary Bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-navy/10 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-brand-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-brand-navy">{totalCount}</p>
            <p className="text-xs text-gray-500 font-medium">Total Questions</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-brand-navy">{activeQuestions.length}</p>
            <p className="text-xs text-gray-500 font-medium">Active</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-brand-navy">{archivedQuestions.length}</p>
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

      {/* Subject + Quiz Select Filters */}
      <div className="flex gap-4 mb-4 items-center">
        {/* Subject Dropdown */}
        <select
          value={selectedSectionId || ""}
          onChange={(e) => {
            const sectionId = e.target.value || null;
            setSelectedSectionId(sectionId);
            setSelectedQuizIdFilter(null);
          }}
          className="px-4 py-2.5 border border-gray-300 rounded-full text-sm focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 min-w-[200px]"
          disabled={sectionsLoading}
        >
          <option value="">
            {sectionsLoading ? "Loading subjects..." : "📚 All Subjects"}
          </option>
          {sections.length === 0 && !sectionsLoading && (
            <option disabled>No subjects found</option>
          )}
          {sections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.section_name}
            </option>
          ))}
        </select>

        {/* Quiz Dropdown (only show if subject selected) */}
        {selectedSectionId && (
          <select
            value={selectedQuizIdFilter || ""}
            onChange={(e) => setSelectedQuizIdFilter(e.target.value || null)}
            className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 min-w-[250px]"
          >
            <option value="">📝 All Quizzes in Subject</option>
            {quizzesFromSection.length === 0 ? (
              <option disabled>No quizzes in this subject</option>
            ) : (
              quizzesFromSection.map((quiz) => (
                <option key={quiz.id} value={quiz.id}>
                  {quiz.title}
                </option>
              ))
            )}
          </select>
        )}

        {/* Cognitive Level Dropdown */}
        <select
          value={selectedCognitiveLevel || ""}
          onChange={(e) => setSelectedCognitiveLevel(e.target.value || null)}
          className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 min-w-[150px]"
        >
          <option value="">🧠 All Levels</option>
          <option value="LOTS">LOTS (Lower Order)</option>
          <option value="HOTS">HOTS (Higher Order)</option>
        </select>

        {/* Search bar */}
        <div className="flex-1 relative">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
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
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>
            Sort
          </button>
          {showSortDropdown && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowSortDropdown(false)} />
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                {[
                  { value: "newest", label: "Newest First" },
                  { value: "oldest", label: "Oldest First" },
                  { value: "points-high", label: "Points: High → Low" },
                  { value: "points-low", label: "Points: Low → High" },
                  { value: "quiz", label: "By Quiz Name" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setSortBy(opt.value); setShowSortDropdown(false); }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-brand-gold/10 transition-colors ${
                      sortBy === opt.value ? "text-brand-gold font-semibold bg-brand-gold/5" : "text-gray-700"
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
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </span>
          ))}
          <button
            onClick={() => { setSearchTerm(""); setSortBy("newest"); setSelectedSectionId(null); setSelectedQuizIdFilter(null); setSelectedCognitiveLevel(null); }}
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
            {activeTab === "active" && (
              <button
                onClick={handleBulkArchive}
                className="flex items-center gap-1.5 px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-semibold hover:bg-yellow-600 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                Archive Selected
              </button>
            )}
            {activeTab === "archived" && (
              <>
                <button
                  onClick={handleBulkRestore}
                  className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  Restore Selected
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-brand-navy/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
                : "Start building your question bank by clicking the \"+ Add to Bank\" button above."}
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
            const isImportSelected = selectedQuestions.some((q) => q.id === question.id);
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
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs text-gray-400 font-medium">
                        {question.quizzes?.title || "Draft Quiz"}
                      </span>
                      <span className="text-xs text-gray-400">
                        {question.points} pt{question.points !== 1 ? "s" : ""}
                      </span>
                      {/* Cognitive Level Badge */}
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        question.cognitive_level === 'HOTS' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {question.cognitive_level || 'LOTS'}
                      </span>
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
                      <h3 className={`text-[15px] font-semibold text-gray-800 ${
                        !isExpanded && activeTab !== "import" ? "line-clamp-2" : ""
                      }`}>
                        {question.text}
                      </h3>
                    </button>

                    {/* 7. Expandable options preview */}
                    {(isExpanded || activeTab === "import") && question.options && (
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
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-auto text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Expand hint */}
                    {!isExpanded && activeTab !== "import" && question.options?.length > 0 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleExpand(question.id); }}
                        className="mt-2 text-xs text-gray-400 hover:text-brand-gold transition-colors flex items-center gap-1"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                        Show {question.options.length} options
                      </button>
                    )}
                    {isExpanded && activeTab !== "import" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleExpand(question.id); }}
                        className="mt-2 text-xs text-gray-400 hover:text-brand-gold transition-colors flex items-center gap-1"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
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
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
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
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
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
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      </button>
                      <button
                        onClick={async () => {
                          const confirmed = await confirm({
                            title: "Remove Question Permanently",
                            message: "Are you sure you want to permanently remove this question?",
                            confirmText: "Remove",
                            cancelText: "Cancel",
                            variant: "danger",
                          });
                          if (confirmed) deleteQuestion(question.id);
                        }}
                        className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                        title="Remove permanently"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, allFiltered.length)} of {allFiltered.length} questions
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
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
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
      )}

      {/* Add Question Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Modal Header */}
            <div className="bg-brand-navy px-6 py-4 rounded-t-xl flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">Add Question to Bank</h2>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-white/60 hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-6">
              {/* Question Text */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Question Text <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={newQuestion.text}
                  onChange={(e) =>
                    setNewQuestion({ ...newQuestion, text: e.target.value })
                  }
                  placeholder="Enter your question"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
                />
              </div>

              {/* Options */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Options <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {newQuestion.options.map((option, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="radio"
                        name="correct-answer"
                        checked={newQuestion.correctAnswer === idx}
                        onChange={() =>
                          setNewQuestion({
                            ...newQuestion,
                            correctAnswer: idx,
                          })
                        }
                        className="mt-3"
                      />
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => updateOption(idx, e.target.value)}
                        placeholder={`Option ${idx + 1}`}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
                      />
                      {newQuestion.options.length > 2 && (
                        <button
                          onClick={() => removeOption(idx)}
                          className="text-red-500 hover:text-red-700 px-3 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={addOption}
                  className="text-brand-gold hover:text-brand-gold-dark font-semibold mt-2 transition-colors"
                >
                  + Add Option
                </button>
              </div>

              {/* Points */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Points
                </label>
                <input
                  type="number"
                  value={newQuestion.points}
                  onChange={(e) =>
                    setNewQuestion({
                      ...newQuestion,
                      points: parseInt(e.target.value) || 1,
                    })
                  }
                  min={1}
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
                />
              </div>

              {/* Cognitive Level */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Cognitive Level
                </label>
                <select
                  value={newQuestion.cognitiveLevel}
                  onChange={(e) =>
                    setNewQuestion({
                      ...newQuestion,
                      cognitiveLevel: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
                >
                  <option value="LOTS">LOTS (Lower Order Thinking Skills)</option>
                  <option value="HOTS">HOTS (Higher Order Thinking Skills)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  LOTS: Remember, Understand, Apply | HOTS: Analyze, Evaluate, Create
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-4">
                <button
                  onClick={handleAddToBank}
                  className="flex-1 bg-brand-gold text-brand-navy px-6 py-3 rounded-lg font-semibold hover:bg-brand-gold-dark transition-colors"
                >
                  Add to Bank
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
