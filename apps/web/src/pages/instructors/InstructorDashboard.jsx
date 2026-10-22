import { useState, useMemo, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { notify } from "../../utils/notify.jsx";
import { useConfirm } from "../../components/ui/ConfirmModal.jsx";
import { CreateSectionButton } from "../../components/ui/buttons/CreateSectionButton.jsx";
import { useFetchSectionQuiz } from "../../hooks/quizHook/useFetchSectionQuiz.jsx";
import { sectionService } from "../../services/sectionService.js";
import { subjectService } from "../../services/subjectService.js";
import { supabase } from "../../supabaseClient.js";
import * as Container from "../../components/container/containers.js";
import * as ClassCard from "../../pages/instructors/ClassSections/classIndex.js";
import { SubjectSectionModal } from "../../components/SubjectSectionModal.jsx";
import { SubjectRequestForm } from "../../components/SubjectRequestForm.jsx";
import { Skeleton } from "../../components/ui/Skeleton.jsx";
import { useEscapeKey } from "../../hooks/useEscapeKey.jsx";
import { useFocusTrap } from "../../hooks/useFocusTrap.jsx";

const ITEMS_PER_PAGE = 6;

const cardThemes = [
  {
    gradient: "from-brand-navy to-brand-indigo",
    button: "bg-brand-gold hover:bg-brand-gold-dark hover:brightness-95 hover:shadow-lg active:brightness-90 text-brand-navy",
    statBg: "bg-brand-navy/5",
    statText: "text-brand-navy",
  },
  {
    gradient: "from-brand-indigo to-brand-indigo-dark",
    button: "bg-brand-gold hover:bg-brand-gold-dark hover:brightness-95 hover:shadow-lg active:brightness-90 text-brand-navy",
    statBg: "bg-brand-indigo/5",
    statText: "text-brand-indigo",
  },
  {
    gradient: "from-brand-indigo-dark to-brand-navy",
    button: "bg-brand-gold hover:bg-brand-gold-dark hover:brightness-95 hover:shadow-lg active:brightness-90 text-brand-navy",
    statBg: "bg-brand-navy/5",
    statText: "text-brand-navy",
  },
];

export const InstructorDashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    user,
    sections = [],
    setSections,
    sectionQuizzes,
    loading,
  } = useFetchSectionQuiz();

  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [archivedPage, setArchivedPage] = useState(1);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedSections, setArchivedSections] = useState([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [editName, setEditName] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [selectedSubjectKey, setSelectedSubjectKey] = useState(null);
  const [showSubjectRequestModal, setShowSubjectRequestModal] = useState(false);
  const [curriculumSubjects, setCurriculumSubjects] = useState([]);
  const confirm = useConfirm();
  useEscapeKey(() => setEditModal(null), Boolean(editModal));
  const editTrapRef = useFocusTrap(Boolean(editModal));

  // Load approved curriculum subjects and requested subjects for this instructor
  const fetchCurriculumSubjects = useCallback(async () => {
    if (!user?.id) return;
    try {
      // 1. Approved curriculum subjects
      const res = await subjectService.getInstructorApprovedSubjects(user.id);
      const approvedList = Array.isArray(res) ? res : res?.data || [];

      // 2. The user's own pending subject requests, shown as "awaiting
      //    approval". A request whose subject is already in the curriculum
      //    (approved for anyone) is no longer pending.
      const [reqRes, curriculumRes] = await Promise.all([
        subjectService.getMySubjectRequests(user.id),
        subjectService.getAllSubjects(),
      ]);
      const reqList = Array.isArray(reqRes) ? reqRes : reqRes?.data || [];
      const norm = (v) => String(v || "").toLowerCase().trim();
      const existing = [...approvedList, ...(curriculumRes?.data || [])].filter(
        (sub) => !sub.status || sub.status === "approved",
      );
      const existingNames = new Set(existing.map((sub) => norm(sub.name || sub.subject_name)));
      const existingCodes = new Set(existing.map((sub) => norm(sub.code)).filter(Boolean));
      const requestedFormatted = reqList
        .filter((r) => r.request_status === "pending")
        .filter(
          (r) =>
            !existingNames.has(norm(r.subject_name)) &&
            !(r.subject_code && existingCodes.has(norm(r.subject_code))),
        )
        .map((r) => ({
          id: `request-${r.id}`,
          subject_id: null,
          name: r.subject_name,
          code: r.subject_code || "",
          grade_level: r.grade_level || "",
          description: r.description || "",
          is_pending_request: true,
        }));

      setCurriculumSubjects([...approvedList, ...requestedFormatted]);
    } catch (err) {
      console.error("Error loading curriculum subjects:", err);
      setCurriculumSubjects([]);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchCurriculumSubjects();
  }, [fetchCurriculumSubjects]);

  useEffect(() => {
    const handleSubjectsChanged = () => {
      fetchCurriculumSubjects();
    };
    window.addEventListener("subjects-changed", handleSubjectsChanged);
    window.addEventListener("subject-requests-changed", handleSubjectsChanged);
    return () => {
      window.removeEventListener("subjects-changed", handleSubjectsChanged);
      window.removeEventListener("subject-requests-changed", handleSubjectsChanged);
    };
  }, [fetchCurriculumSubjects]);

  // Fetch archived sections on mount so the badge count is always available
  useEffect(() => {
    if (!user?.id) return;
    const fetchArchived = async () => {
      setArchivedLoading(true);
      try {
        const { data } = await supabase
          .from("sections")
          .select("*, subjects(id, name, code, description)")
          .eq("instructor_id", user.id)
          .eq("is_archived", true)
          .order("created_at", { ascending: false });
        setArchivedSections(data || []);
      } catch (err) {
        console.error("Error loading archived sections:", err);
      } finally {
        setArchivedLoading(false);
      }
    };
    fetchArchived();
  }, [user?.id]);

  const handleToggleArchived = () => {
    setShowArchived(!showArchived);
  };

  const handleArchiveSection = async (sectionId, sectionName) => {
    const confirmed = await confirm({
      title: "Archive this section?",
      confirmText: "Archive",
      cancelText: "Cancel",
      variant: "warning",
    });
    if (!confirmed) return;

    try {
      const { error } = await sectionService.archiveSection(sectionId);
      if (error) throw error;

      const archived = sections.find((s) => s.id === sectionId);
      setSections((prev) => prev.filter((s) => s.id !== sectionId));
      if (archived) {
        setArchivedSections((prev) => [archived, ...prev]);
      }
      notify.success(`"${sectionName}" archived!`);
    } catch (err) {
      notify.error("Failed to archive section: " + err.message);
    }
  };

  const handleRestoreSection = async (sectionId) => {
    try {
      const { error } = await sectionService.updateSection(sectionId, {
        is_archived: false,
      });
      if (error) throw error;

      const restored = archivedSections.find((s) => s.id === sectionId);
      setArchivedSections((prev) => prev.filter((s) => s.id !== sectionId));
      if (restored) {
        setSections((prev) => [restored, ...prev]);
      }
      notify.success("Section restored!");
    } catch (err) {
      notify.error("Failed to restore section: " + err.message);
    }
  };

  const handleEditSection = (section) => {
    setEditModal(section);
    setEditName(section.name || "");
    setEditSubject(section.description || "");
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      notify.error("Section name is required");
      return;
    }

    setEditSaving(true);
    try {
      const { error } = await sectionService.updateSection(editModal.id, {
        name: editName.trim(),
        description: editSubject.trim(),
      });
      if (error) throw error;

      setSections((prev) =>
        prev.map((s) =>
          s.id === editModal.id
            ? { ...s, name: editName.trim(), description: editSubject.trim() }
            : s,
        ),
      );
      notify.success("Section updated!");
      setEditModal(null);
    } catch (err) {
      notify.error("Failed to update section: " + err.message);
    } finally {
      setEditSaving(false);
    }
  };

  // Group sections by Subject (Normalized View with multi-key de-duplication)
  const groupedSubjects = useMemo(() => {
    const list = [];

    const findEntry = (id, name, code) => {
      const normName = name ? name.toLowerCase().trim() : null;
      const normCode = code ? code.toLowerCase().trim() : null;

      for (const entry of list) {
        if (id && (entry.id === id || entry.subject_id === id)) return entry;
        if (normName && entry.name && entry.name.toLowerCase().trim() === normName) return entry;
        if (normCode && entry.code && entry.code.toLowerCase().trim() === normCode) return entry;
      }
      return null;
    };

    // 1. Populate approved curriculum subjects and requested subjects
    const subjectList = Array.isArray(curriculumSubjects)
      ? curriculumSubjects
      : Array.isArray(curriculumSubjects?.data)
      ? curriculumSubjects.data
      : [];

    subjectList.forEach((sub) => {
      if (!sub) return;
      const subName = (sub.name || sub.subject_name || "").trim();
      const subCode = (sub.code || sub.subject_code || "").trim();
      if (!subName) return;

      const existing = findEntry(sub.id, subName, subCode);
      if (existing) {
        if (!existing.id && sub.id) existing.id = sub.id;
        if (!existing.subject_id && (sub.subject_id || sub.id)) {
          existing.subject_id = sub.subject_id || sub.id;
        }
        if (!existing.code && subCode) existing.code = subCode;
        if (!existing.description && sub.description) existing.description = sub.description;
        if (!existing.grade_level && sub.grade_level) existing.grade_level = sub.grade_level;
      } else {
        list.push({
          id: sub.id,
          subject_id: sub.subject_id || sub.id,
          name: subName,
          code: subCode,
          description: sub.description || "",
          grade_level: sub.grade_level || "",
          is_pending_request: Boolean(sub.is_pending_request),
          sections: [],
        });
      }
    });

    // 2. Merge assigned sections into corresponding subject groups
    const secList = Array.isArray(sections) ? sections : [];
    secList.forEach((sec) => {
      if (!sec) return;
      const subjectObj = sec.subjects || {};
      let subName = subjectObj.name;
      let subCode = subjectObj.code || "";
      let subDesc = subjectObj.description || sec.description || "";

      if (!subName) {
        if (sec.name && sec.name.includes(" - ")) {
          subName = sec.name.split(" - ")[0].trim();
        } else {
          subName = sec.name || "Untitled Subject";
        }
      }

      const secSubId = subjectObj.id || sec.subject_id;
      const existing = findEntry(secSubId, subName, subCode);

      if (existing) {
        if (!existing.sections.some((s) => s.id === sec.id)) {
          existing.sections.push(sec);
        }
        if (!existing.id && secSubId) existing.id = secSubId;
        if (!existing.subject_id && secSubId) existing.subject_id = secSubId;
        if (!existing.code && subCode) existing.code = subCode;
        if (!existing.description && subDesc) existing.description = subDesc;
        if (!existing.grade_level && subjectObj.grade_level) {
          existing.grade_level = subjectObj.grade_level;
        }
      } else {
        list.push({
          id: secSubId || sec.id,
          subject_id: secSubId || sec.id,
          name: subName,
          code: subCode,
          description: subDesc,
          grade_level: subjectObj.grade_level || sec.grade_level || "",
          sections: [sec],
        });
      }
    });

    return list;
  }, [curriculumSubjects, sections]);

  const selectedSubjectForModal = useMemo(
    () => groupedSubjects.find((sub) => (sub.id || sub.name) === selectedSubjectKey) || null,
    [groupedSubjects, selectedSubjectKey],
  );
  const openSubject = (sub) => {
    if (sub.is_pending_request) return;
    setSelectedSubjectKey(sub.id || sub.name);
  };

  // "Back to Sections" from a section page reopens that subject's sections
  const { openSubjectId, openSubjectName } = location.state || {};
  useEffect(() => {
    if (!openSubjectId && !openSubjectName) return;
    const name = openSubjectName?.toLowerCase().trim();
    const target = groupedSubjects.find(
      (sub) =>
        (openSubjectId && (sub.id === openSubjectId || sub.subject_id === openSubjectId)) ||
        (name && sub.name?.toLowerCase().trim() === name),
    );
    if (!target) return; // subjects may still be loading
    setSelectedSubjectKey(target.id || target.name);
    // Consume the state so a refresh doesn't reopen it
    navigate(location.pathname, { replace: true, state: null });
  }, [openSubjectId, openSubjectName, groupedSubjects, navigate, location.pathname]);

  // Filter grouped subjects by search
  const filteredSubjects = useMemo(() => {
    if (!search.trim()) return groupedSubjects;
    const q = search.trim().toLowerCase();
    return groupedSubjects.filter(
      (sub) =>
        sub.name?.toLowerCase().includes(q) ||
        sub.code?.toLowerCase().includes(q) ||
        sub.description?.toLowerCase().includes(q) ||
        sub.sections.some((sec) => sec.name?.toLowerCase().includes(q)),
    );
  }, [groupedSubjects, search]);

  const totalPages = Math.ceil(filteredSubjects.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedSubjects = filteredSubjects.slice(startIndex, endIndex);

  const filteredArchived = useMemo(() => {
    if (!search.trim()) return archivedSections;
    const q = search.trim().toLowerCase();
    return archivedSections.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q),
    );
  }, [archivedSections, search]);

  const archivedTotalPages = Math.ceil(
    filteredArchived.length / ITEMS_PER_PAGE,
  );
  const archivedStartIndex = (archivedPage - 1) * ITEMS_PER_PAGE;
  const archivedEndIndex = archivedStartIndex + ITEMS_PER_PAGE;
  const paginatedArchived = filteredArchived.slice(
    archivedStartIndex,
    archivedEndIndex,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  useEffect(() => {
    setArchivedPage(1);
  }, [search, showArchived]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (archivedPage > archivedTotalPages && archivedTotalPages > 0) {
      setArchivedPage(archivedTotalPages);
    }
  }, [archivedPage, archivedTotalPages]);

  if (loading) {
    return (
      <div className="flex-1 overflow-auto bg-authentic-white" aria-label="Loading subjects">
        <div className="bg-gradient-to-r from-brand-navy to-brand-indigo px-6 py-8">
          <Skeleton tone="bg-white/20" className="h-4 w-44 rounded-md mb-2" />
          <Skeleton tone="bg-white/20" className="h-8 w-56 rounded-md mb-2" />
          <Skeleton tone="bg-white/20" className="h-4 w-72 max-w-full rounded-md" />
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  const isAdminPath = location.pathname.startsWith("/admin-dashboard");

  return (
    <>
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-brand-navy to-brand-indigo px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-brand-gold text-sm font-semibold tracking-widest uppercase mb-1">
              {isAdminPath ? "Senior Faculty" : "Instructor Portal"}
            </p>
            <h1 className="text-2xl md:text-3xl font-black text-white">
              Subjects
            </h1>
            <p className="text-white/60 text-sm mt-1">
              {groupedSubjects.length} {groupedSubjects.length === 1 ? "subject" : "subjects"}{" "}
              ({sections.length} total assigned sections)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSubjectRequestModal(true)}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-bold border border-white/20 transition-all flex items-center gap-2 cursor-pointer shadow-xs active:scale-98 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70"
              title="Request a new curriculum subject from the Department Head"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-brand-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>Request Subject</span>
            </button>
            <CreateSectionButton
              userId={user?.id}
              onSectionCreated={(newSec) => {
                setSections((prev) => [newSec, ...prev]);
              }}
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-6">
        {/* Search and Filters Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <label htmlFor="subject-search" className="sr-only">
              Search subjects or sections
            </label>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              id="subject-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search subjects or sections..."
              className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-brand-navy placeholder:text-slate-400 focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 transition-all shadow-xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 rounded"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleArchived}
              aria-pressed={showArchived}
              className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 ${
                showArchived
                  ? "bg-brand-navy text-white border-brand-navy shadow-sm"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 shadow-2xs"
              }`}
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
              <span>{showArchived ? "Show Active Subjects" : "Archived Sections"}</span>
              {!showArchived && archivedSections.length > 0 && (
                <span
                  className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                    showArchived
                      ? "bg-white/25 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {archivedSections.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Normalized Subject Cards */}
        {showArchived ? null : filteredSubjects.length === 0 ? (
          <ClassCard.EmptyClassSection
            title={search.trim() ? "No Subjects Found" : "No Subjects Assigned Yet"}
            description={
              search.trim()
                ? `No subjects or sections match "${search}". Try a different keyword.`
                : "Add a subject from the curriculum to start managing your sections and exams."
            }
            icon={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-8 h-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.75}
              >
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                <line x1="12" y1="6" x2="12" y2="12" />
                <line x1="9" y1="9" x2="15" y2="9" />
              </svg>
            }
          />
        ) : (
          <>
            <Container.ContentContainer>
              {paginatedSubjects.map((sub, idx) => {
                const theme = cardThemes[idx % cardThemes.length];

                // Compute aggregate quiz stats across all sections for this subject
                let aggregateQuizzesCount = 0;
                let aggregateAttemptsCount = 0;

                sub.sections.forEach((sec) => {
                  const qList = sectionQuizzes[sec.id] || [];
                  aggregateQuizzesCount += qList.length;
                  aggregateAttemptsCount += qList.reduce(
                    (sum, q) => sum + (q.attempts || 0),
                    0,
                  );
                });

                return (
                  <Container.SectionContainer key={sub.id || idx}>
                    <div className="flex flex-col h-full relative bg-white overflow-hidden">
                      {/* Subject Card Header */}
                      <button
                        type="button"
                        className={`relative h-28 w-full bg-gradient-to-br ${theme.gradient} flex items-end p-5 text-white text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-gold`}
                        onClick={() => openSubject(sub)}
                        aria-label={
                          sub.is_pending_request
                            ? `${sub.name} (awaiting Department Head approval)`
                            : `View sections for ${sub.name}`
                        }
                        aria-disabled={sub.is_pending_request || undefined}
                      >
                        <div
                          className="absolute inset-0 opacity-10"
                          style={{
                            backgroundImage:
                              "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Ccircle cx='20' cy='20' r='3'/%3E%3C/g%3E%3C/svg%3E\")",
                          }}
                        />
                        <div className="relative z-[1] w-full">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            {sub.code && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-white/20 text-white uppercase tracking-wider backdrop-blur-xs">
                                {sub.code}
                              </span>
                            )}
                            {sub.is_pending_request ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-white/90 text-brand-navy shadow-xs">
                                Awaiting Approval
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-brand-gold text-brand-navy shadow-xs">
                                {sub.sections.length} Section{sub.sections.length === 1 ? "" : "s"}
                              </span>
                            )}
                          </div>
                          <h2 className="text-xl font-bold leading-tight drop-shadow line-clamp-1">
                            {sub.name}
                          </h2>
                        </div>
                      </button>

                      {/* Subject Card Body */}
                      <div className="p-5 flex flex-col flex-1 justify-between bg-white">
                        {/* Section Pills */}
                        <div className="mb-4">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">
                            Assigned Sections
                          </p>
                          <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto">
                            {sub.is_pending_request ? (
                              <span className="text-xs text-slate-500 py-1">
                                Requested subject. You can add sections once the Department Head approves it.
                              </span>
                            ) : sub.sections.length === 0 ? (
                              <span className="text-xs text-slate-400 italic py-1">
                                No sections assigned
                              </span>
                            ) : (
                              sub.sections.map((sec) => {
                                const sectionCode = sec.description || sec.section_code || "";
                                let secDisplayName = sec.name || "";
                                if (secDisplayName.includes(" - ")) {
                                  const parts = secDisplayName.split(" - ");
                                  secDisplayName = parts[parts.length - 1].trim();
                                }
                                const label = sectionCode || secDisplayName;

                                return (
                                  <button
                                    type="button"
                                    key={sec.id}
                                    onClick={() => openSubject(sub)}
                                    className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 hover:bg-brand-navy hover:text-white transition-colors border border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
                                    title={`Section: ${sectionCode || secDisplayName}`}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-brand-navy group-hover:text-brand-gold transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                                    </svg>
                                    <span>{label}</span>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>

                        {/* Aggregate Stats */}
                        <div className="grid grid-cols-2 gap-2 py-3 border-t border-gray-100 mb-4">
                          <div className={`rounded-xl px-3 py-2 text-center ${theme.statBg}`}>
                            <p className={`text-sm font-black ${theme.statText}`}>
                              {aggregateQuizzesCount}
                            </p>
                            <p className="text-[10px] text-gray-500 font-semibold uppercase">
                              Exams
                            </p>
                          </div>
                          <div className={`rounded-xl px-3 py-2 text-center ${theme.statBg}`}>
                            <p className={`text-sm font-black ${theme.statText}`}>
                              {aggregateAttemptsCount}
                            </p>
                            <p className="text-[10px] text-gray-500 font-semibold uppercase">
                              Total Attempts
                            </p>
                          </div>
                        </div>

                        {/* Action Button */}
                        <button
                          onClick={() => openSubject(sub)}
                          disabled={sub.is_pending_request}
                          className={`w-full py-2.5 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${theme.button}`}
                        >
                          <span>
                            {sub.is_pending_request
                              ? "Pending Approval"
                              : `View Sections (${sub.sections.length})`}
                          </span>
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </Container.SectionContainer>
                );
              })}
            </Container.ContentContainer>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-xs text-gray-400">
                  Showing {startIndex + 1}–
                  {Math.min(endIndex, filteredSubjects.length)} of{" "}
                  {filteredSubjects.length} subjects
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      setCurrentPage((page) => Math.max(1, page - 1))
                    }
                    disabled={currentPage === 1}
                    aria-label="Previous page"
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
                  >
                    Prev
                  </button>
                  {Array.from(
                    { length: totalPages },
                    (_, index) => index + 1,
                  ).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      aria-label={`Go to page ${page}`}
                      aria-current={page === currentPage ? "page" : undefined}
                      className={`w-8 h-8 text-xs font-semibold rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 ${
                        page === currentPage
                          ? "bg-brand-gold text-brand-navy"
                          : "text-gray-500 hover:bg-gray-100"
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() =>
                      setCurrentPage((page) => Math.min(totalPages, page + 1))
                    }
                    disabled={currentPage === totalPages}
                    aria-label="Next page"
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Archived Sections */}
        {showArchived && (
          <div>
            <h2 className="text-lg font-bold text-gray-600 mb-4 flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
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
              Archived Sections
            </h2>
            {archivedLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-label="Loading archived sections">
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </div>
            ) : filteredArchived.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center shadow-xs border border-slate-200">
                <p className="text-gray-500 text-sm">
                  {search.trim()
                    ? "No archived sections match your search."
                    : "No archived sections."}
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {paginatedArchived.map((section) => (
                    <div
                      key={section.id}
                      className="bg-white rounded-2xl border border-gray-200 shadow-xs hover:shadow-lg hover:-translate-y-0.5 transition-all p-4 flex items-center justify-between opacity-70 hover:opacity-100"
                    >
                      <div>
                        <h3 className="font-bold text-gray-700">
                          {section.name}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {section.subjects?.name || section.description || "No subject"}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRestoreSection(section.id)}
                        aria-label={`Restore ${section.name}`}
                        className="px-3 py-1.5 bg-brand-gold text-brand-navy text-xs font-semibold rounded-lg hover:bg-brand-gold-dark hover:brightness-95 hover:shadow-lg active:brightness-90 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>

                {archivedTotalPages > 1 && (
                  <div className="flex items-center justify-between mt-6">
                    <p className="text-xs text-gray-400">
                      Showing {archivedStartIndex + 1}–
                      {Math.min(archivedEndIndex, filteredArchived.length)} of{" "}
                      {filteredArchived.length}
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          setArchivedPage((page) => Math.max(1, page - 1))
                        }
                        disabled={archivedPage === 1}
                        aria-label="Previous archived page"
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
                      >
                        Prev
                      </button>
                      {Array.from(
                        { length: archivedTotalPages },
                        (_, index) => index + 1,
                      ).map((page) => (
                        <button
                          key={page}
                          onClick={() => setArchivedPage(page)}
                          aria-label={`Go to archived page ${page}`}
                          aria-current={page === archivedPage ? "page" : undefined}
                          className={`w-8 h-8 text-xs font-semibold rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 ${
                            page === archivedPage
                              ? "bg-brand-gold text-brand-navy"
                              : "text-gray-500 hover:bg-gray-100"
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                      <button
                        onClick={() =>
                          setArchivedPage((page) =>
                            Math.min(archivedTotalPages, page + 1),
                          )
                        }
                        disabled={archivedPage === archivedTotalPages}
                        aria-label="Next archived page"
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Modal to view assigned sections when subject card is clicked */}
      <SubjectSectionModal
        isOpen={!!selectedSubjectForModal}
        onClose={() => setSelectedSubjectKey(null)}
        subject={selectedSubjectForModal}
        sections={selectedSubjectForModal?.sections || []}
        sectionQuizzes={sectionQuizzes}
        userId={user?.id}
        onSectionCreated={(newSec) => {
          setSections((prev) => [newSec, ...prev]);
        }}
        onArchiveSection={(sec) => handleArchiveSection(sec.id, sec.name)}
        onEditSection={(sec) => handleEditSection(sec)}
      />

      {/* Modal for editing section */}
      {editModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div ref={editTrapRef} role="dialog" aria-modal="true" aria-labelledby="edit-section-title" className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 id="edit-section-title" className="text-lg font-bold text-brand-navy mb-4">
              Edit Section
            </h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="edit-subject-name" className="block text-xs font-semibold text-gray-600 mb-1">
                  Section Name
                </label>
                <input
                  id="edit-subject-name"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-brand-navy placeholder:text-slate-400 focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 transition-all"
                />
              </div>
              <div>
                <label htmlFor="edit-subject-description" className="block text-xs font-semibold text-gray-600 mb-1">
                  Section Code (e.g., T390 or T23)
                </label>
                <input
                  id="edit-subject-description"
                  type="text"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-brand-navy placeholder:text-slate-400 focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 transition-all"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditModal(null)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editSaving}
                className="px-4 py-2 text-sm font-semibold bg-brand-gold text-brand-navy rounded-lg hover:bg-brand-gold-dark hover:brightness-95 hover:shadow-lg active:brightness-90 transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
              >
                {editSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSubjectRequestModal && (
        <SubjectRequestForm
          isOpen={showSubjectRequestModal}
          onClose={() => setShowSubjectRequestModal(false)}
          onRequestSubmitted={() => {
            window.dispatchEvent(new CustomEvent("subject-requests-changed"));
            window.dispatchEvent(new CustomEvent("pending-subject-requests-changed"));
          }}
        />
      )}
    </>
  );
};
