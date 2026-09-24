import { useState, useMemo, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { notify } from "../../utils/notify.jsx";
import { useConfirm } from "../../components/ui/ConfirmModal.jsx";
import { CreateSectionButton } from "../../components/ui/buttons/CreateSectionButton.jsx";
import { useFetchSectionQuiz } from "../../hooks/quizHook/useFetchSectionQuiz.jsx";
import { sectionService } from "../../services/sectionService.js";
import { subjectService } from "../../services/subjectService.js";
import { supabase } from "../../supabaseClient.js";
import * as Container from "../../components/container/containers.js";
import * as ClassCard from "../../pages/instructors/ClassSections/classIndex.js";
import { InstructorSubjectRequests } from "../../components/InstructorSubjectRequests.jsx";
import { SubjectSectionModal } from "../../components/SubjectSectionModal.jsx";

const ITEMS_PER_PAGE = 6;

const cardThemes = [
  {
    gradient: "from-brand-navy to-brand-indigo",
    button: "bg-brand-gold hover:bg-brand-gold-dark text-brand-navy",
    statBg: "bg-brand-navy/5",
    statText: "text-brand-navy",
  },
  {
    gradient: "from-brand-indigo to-brand-indigo-dark",
    button: "bg-brand-gold hover:bg-brand-gold-dark text-brand-navy",
    statBg: "bg-brand-indigo/5",
    statText: "text-brand-indigo",
  },
  {
    gradient: "from-brand-indigo-dark to-brand-navy",
    button: "bg-brand-gold hover:bg-brand-gold-dark text-brand-navy",
    statBg: "bg-brand-navy/5",
    statText: "text-brand-navy",
  },
];

export const InstructorDashboard = () => {
  const location = useLocation();
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
  const [selectedSubjectForModal, setSelectedSubjectForModal] = useState(null);
  const [addSectionSubject, setAddSectionSubject] = useState(null);
  const confirm = useConfirm();

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

  // Handler to archive an entire Subject along with its assigned sections
  const handleArchiveSubject = async (subGroup) => {
    const confirmed = await confirm({
      title: "Archive Subject",
      message: `Archive "${subGroup.name}"? This subject and all its assigned sections will be moved to the Archived tab. You can restore or permanently remove it later.`,
      confirmText: "Archive Subject",
      cancelText: "Cancel",
      variant: "warning",
    });
    if (!confirmed) return;

    try {
      // 1. Archive all sections belonging to this subject group
      if (subGroup.sections && subGroup.sections.length > 0) {
        await Promise.all(
          subGroup.sections.map((sec) => sectionService.archiveSection(sec.id))
        );
      }

      // 2. Archive subject entry in database if subject_id is present
      const subjectIdToUse = subGroup.subject_id || subGroup.id;
      if (subjectIdToUse) {
        try {
          await subjectService.archiveSubject(subjectIdToUse);
        } catch (sErr) {
          console.warn("Could not archive subject record:", sErr);
        }
      }

      // 3. Update local state
      const archivedSecs = subGroup.sections.map((s) => ({ ...s, is_archived: true }));
      const remainingSections = sections.filter(
        (sec) => !subGroup.sections.some((s) => s.id === sec.id)
      );

      setSections(remainingSections);
      setArchivedSections((prev) => [...archivedSecs, ...prev]);

      notify.success(`Subject "${subGroup.name}" archived successfully!`);
    } catch (err) {
      console.error("Error archiving subject:", err);
      notify.error("Failed to archive subject: " + err.message);
    }
  };

  // Handler to restore an archived Subject and its sections
  const handleRestoreSubject = async (subGroup) => {
    const confirmed = await confirm({
      title: "Restore Subject",
      message: `Restore "${subGroup.name}"? This subject and its sections will be moved back to your active subjects list.`,
      confirmText: "Restore Subject",
      cancelText: "Cancel",
      variant: "info",
    });
    if (!confirmed) return;

    try {
      // 1. Unarchive sections
      if (subGroup.sections && subGroup.sections.length > 0) {
        await Promise.all(
          subGroup.sections.map((sec) =>
            sectionService.updateSection(sec.id, { is_archived: false })
          )
        );
      }

      // 2. Unarchive subject entry in database
      const subjectIdToUse = subGroup.subject_id || subGroup.id;
      if (subjectIdToUse) {
        try {
          await subjectService.unarchiveSubject(subjectIdToUse);
        } catch (sErr) {
          console.warn("Could not unarchive subject record:", sErr);
        }
      }

      // 3. Update local state
      const restoredSecs = subGroup.sections.map((s) => ({ ...s, is_archived: false }));
      setArchivedSections((prev) =>
        prev.filter((sec) => !subGroup.sections.some((s) => s.id === sec.id))
      );
      setSections((prev) => [...restoredSecs, ...prev]);

      notify.success(`Subject "${subGroup.name}" restored successfully!`);
    } catch (err) {
      console.error("Error restoring subject:", err);
      notify.error("Failed to restore subject: " + err.message);
    }
  };

  // Handler to permanently remove/delete an archived Subject
  const handleDeleteSubject = async (subGroup) => {
    const confirmed = await confirm({
      title: "Permanently Remove Subject",
      message: `Are you sure you want to permanently remove "${subGroup.name}" and all its assigned sections? This action cannot be undone.`,
      confirmText: "Remove Permanently",
      cancelText: "Cancel",
      variant: "danger",
    });
    if (!confirmed) return;

    try {
      // 1. Delete sections under this subject
      if (subGroup.sections && subGroup.sections.length > 0) {
        await Promise.all(
          subGroup.sections.map((sec) => sectionService.deleteSection(sec.id))
        );
      }

      // 2. Delete subject entry if applicable
      const subjectIdToUse = subGroup.subject_id || subGroup.id;
      if (subjectIdToUse) {
        try {
          await subjectService.deleteSubject(subjectIdToUse);
        } catch (sErr) {
          console.warn("Could not delete subject record:", sErr);
        }
      }

      // 3. Update local state
      setArchivedSections((prev) =>
        prev.filter((sec) => !subGroup.sections.some((s) => s.id === sec.id))
      );
      setSections((prev) =>
        prev.filter((sec) => !subGroup.sections.some((s) => s.id === sec.id))
      );

      notify.success(`Subject "${subGroup.name}" permanently removed!`);
    } catch (err) {
      console.error("Error removing subject:", err);
      notify.error("Failed to remove subject: " + err.message);
    }
  };

  const handleEditSection = (section) => {
    setEditModal(section);
    setEditName(section.name || "");
    setEditSubject(section.description || "");
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      notify.error("Subject name is required");
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
      notify.success("Subject updated!");
      setEditModal(null);
    } catch (err) {
      notify.error("Failed to update section: " + err.message);
    } finally {
      setEditSaving(false);
    }
  };

  // Group sections by Subject (Normalized View)
  const groupedSubjects = useMemo(() => {
    const map = new Map();

    (sections || []).forEach((sec) => {
      const subjectObj = sec.subjects || {};
      let subName = subjectObj.name;
      let subCode = subjectObj.code || "";
      let subDesc = subjectObj.description || sec.description || "";

      if (!subName) {
        if (sec.name && sec.name.includes("-")) {
          const parts = sec.name.split("-");
          subName = parts[0].trim();
        } else {
          subName = sec.name || "Untitled Subject";
        }
      }

      const key = (subjectObj.id || subName).toLowerCase().trim();

      if (!map.has(key)) {
        map.set(key, {
          id: subjectObj.id || sec.id,
          subject_id: subjectObj.id || sec.subject_id,
          name: subName,
          code: subCode,
          description: subDesc,
          sections: [sec],
        });
      } else {
        const existing = map.get(key);
        if (!existing.sections.some((s) => s.id === sec.id)) {
          existing.sections.push(sec);
        }
        if (!existing.code && subCode) existing.code = subCode;
        if (!existing.description && subDesc) existing.description = subDesc;
      }
    });

    return Array.from(map.values());
  }, [sections]);

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

  // Group archived sections by Subject
  const groupedArchivedSubjects = useMemo(() => {
    const map = new Map();

    (archivedSections || []).forEach((sec) => {
      const subjectObj = sec.subjects || {};
      let subName = subjectObj.name;
      let subCode = subjectObj.code || "";
      let subDesc = subjectObj.description || sec.description || "";

      if (!subName) {
        if (sec.name && sec.name.includes("-")) {
          const parts = sec.name.split("-");
          subName = parts[0].trim();
        } else {
          subName = sec.name || "Untitled Subject";
        }
      }

      const key = (subjectObj.id || subName).toLowerCase().trim();

      if (!map.has(key)) {
        map.set(key, {
          id: subjectObj.id || sec.id,
          subject_id: subjectObj.id || sec.subject_id,
          name: subName,
          code: subCode,
          description: subDesc,
          sections: [sec],
        });
      } else {
        const existing = map.get(key);
        if (!existing.sections.some((s) => s.id === sec.id)) {
          existing.sections.push(sec);
        }
        if (!existing.code && subCode) existing.code = subCode;
        if (!existing.description && subDesc) existing.description = subDesc;
      }
    });

    return Array.from(map.values());
  }, [archivedSections]);

  const filteredArchivedSubjects = useMemo(() => {
    if (!search.trim()) return groupedArchivedSubjects;
    const q = search.trim().toLowerCase();
    return groupedArchivedSubjects.filter(
      (sub) =>
        sub.name?.toLowerCase().includes(q) ||
        sub.code?.toLowerCase().includes(q) ||
        sub.description?.toLowerCase().includes(q) ||
        sub.sections.some((sec) => sec.name?.toLowerCase().includes(q)),
    );
  }, [groupedArchivedSubjects, search]);

  const archivedTotalPages = Math.ceil(
    filteredArchivedSubjects.length / ITEMS_PER_PAGE,
  );
  const archivedStartIndex = (archivedPage - 1) * ITEMS_PER_PAGE;
  const archivedEndIndex = archivedStartIndex + ITEMS_PER_PAGE;
  const paginatedArchivedSubjects = filteredArchivedSubjects.slice(
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
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)] bg-authentic-white">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand-gold"></div>
          <p className="mt-4 text-brand-navy font-semibold">
            Loading subjects...
          </p>
        </div>
      </div>
    );
  }

  const isAdminPath = location.pathname.startsWith("/admin-dashboard");

  return (
    <>
      {/* Hero Banner */}
      <div className="bg-brand-navy px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-brand-gold text-sm font-semibold uppercase tracking-widest mb-1">
              {isAdminPath ? "Senior Faculty" : "Instructor Dashboard"}
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
        {/* Subject Requests Section */}
        <InstructorSubjectRequests />

        {/* Search and Filters Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
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
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search subjects or sections..."
              className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 transition-all shadow-xs"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
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
              onClick={handleToggleArchived}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
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
              <span>Archived</span>
              {groupedArchivedSubjects.length > 0 && (
                <span
                  className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                    showArchived
                      ? "bg-white/25 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {groupedArchivedSubjects.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Normalized Subject Cards */}
        {filteredSubjects.length === 0 && !showArchived ? (
          <ClassCard.EmptyClassSection
            title={search.trim() ? "No Subjects Found" : "No Subjects Assigned Yet"}
            description={
              search.trim()
                ? `No subjects or sections match "${search}". Try a different keyword.`
                : "Add a subject from the curriculum to start managing your sections and quizzes."
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
                    <div className="flex flex-col h-full relative group bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-xs hover:shadow-lg transition-all duration-200">
                      {/* Subject Card Header */}
                      <div
                        className={`relative h-28 bg-gradient-to-br ${theme.gradient} flex items-end p-5 text-white cursor-pointer`}
                        onClick={() => setSelectedSubjectForModal(sub)}
                      >
                        <div
                          className="absolute inset-0 opacity-10"
                          style={{
                            backgroundImage:
                              "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Ccircle cx='20' cy='20' r='3'/%3E%3C/g%3E%3C/svg%3E\")",
                          }}
                        />

                        {/* Archive Subject Quick Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleArchiveSubject(sub);
                          }}
                          title="Archive Subject"
                          className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/20 hover:bg-black/40 text-white/80 hover:text-white transition-colors cursor-pointer z-10"
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

                        <div className="relative z-[1] w-full">
                          <div className="flex items-center justify-between gap-2 mb-1 pr-8">
                            {sub.code && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-white/20 text-white uppercase tracking-wider backdrop-blur-xs">
                                {sub.code}
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-brand-gold text-brand-navy shadow-xs">
                              {sub.sections.length} Section{sub.sections.length === 1 ? "" : "s"}
                            </span>
                          </div>
                          <h2 className="text-xl font-bold leading-tight drop-shadow line-clamp-1">
                            {sub.name}
                          </h2>
                        </div>
                      </div>

                      {/* Subject Card Body */}
                      <div className="p-5 flex flex-col flex-1 justify-between bg-white">
                        {/* Section Pills */}
                        <div className="mb-4">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">
                            Assigned Sections
                          </p>
                          <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto">
                            {sub.sections.map((sec) => {
                              const sectionCode = sec.description || sec.section_code || "";
                              let secDisplayName = sec.name || "";
                              if (secDisplayName.includes("-")) {
                                const parts = secDisplayName.split("-");
                                secDisplayName = parts[parts.length - 1].trim();
                              }
                              const label = sectionCode || secDisplayName;

                              return (
                                <span
                                  key={sec.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedSubjectForModal(sub);
                                  }}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 hover:bg-brand-navy hover:text-white transition-colors cursor-pointer border border-slate-200"
                                  title={`Section: ${sectionCode || secDisplayName}`}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-brand-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                                  </svg>
                                  <span>{label}</span>
                                </span>
                              );
                            })}
                          </div>
                        </div>

                        {/* Aggregate Stats */}
                        <div className="grid grid-cols-2 gap-2 py-3 border-t border-gray-100 mb-4">
                          <div className={`rounded-xl px-3 py-2 text-center ${theme.statBg}`}>
                            <p className={`text-sm font-black ${theme.statText}`}>
                              {aggregateQuizzesCount}
                            </p>
                            <p className="text-[10px] text-gray-500 font-semibold uppercase">
                              Quizzes
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
                          onClick={() => setSelectedSubjectForModal(sub)}
                          className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs ${theme.button}`}
                        >
                          <span>View Sections ({sub.sections.length})</span>
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
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
                      className={`w-8 h-8 text-xs font-semibold rounded-lg transition-colors ${
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
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Archived Subjects Section */}
        {showArchived && (
          <div className="mt-8">
            <h2 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-slate-500"
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
              <span>Archived Subjects ({groupedArchivedSubjects.length})</span>
            </h2>

            {archivedLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-brand-gold"></div>
              </div>
            ) : paginatedArchivedSubjects.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center shadow-xs border border-gray-200">
                <p className="text-gray-500 text-sm">
                  {search.trim()
                    ? `No archived subjects match "${search}".`
                    : "No archived subjects found."}
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {paginatedArchivedSubjects.map((sub, idx) => (
                    <div
                      key={sub.id || idx}
                      className="bg-white rounded-2xl border border-gray-200 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          {sub.code ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-100 text-slate-700 uppercase tracking-wider">
                              {sub.code}
                            </span>
                          ) : (
                            <span />
                          )}
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                            Archived
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-gray-800 line-clamp-1 mb-1">
                          {sub.name}
                        </h3>
                        {sub.description && (
                          <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                            {sub.description}
                          </p>
                        )}

                        <div className="my-3 pt-3 border-t border-gray-100">
                          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                            Assigned Sections ({sub.sections.length})
                          </p>
                          <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                            {sub.sections.map((sec) => (
                              <span
                                key={sec.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200"
                              >
                                {sec.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons: Restore & Remove */}
                      <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-2">
                        <button
                          onClick={() => handleRestoreSubject(sub)}
                          className="flex-1 py-2 bg-brand-navy hover:bg-brand-indigo text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-3.5 w-3.5 text-brand-gold"
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
                          <span>Restore</span>
                        </button>
                        <button
                          onClick={() => handleDeleteSubject(sub)}
                          className="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          title="Remove / Delete Subject"
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
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {archivedTotalPages > 1 && (
                  <div className="flex items-center justify-between mt-6">
                    <p className="text-xs text-gray-400">
                      Showing {archivedStartIndex + 1}–
                      {Math.min(archivedEndIndex, filteredArchivedSubjects.length)} of{" "}
                      {filteredArchivedSubjects.length} archived subjects
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          setArchivedPage((page) => Math.max(1, page - 1))
                        }
                        disabled={archivedPage === 1}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
                          className={`w-8 h-8 text-xs font-semibold rounded-lg transition-colors ${
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
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
        onClose={() => setSelectedSubjectForModal(null)}
        subject={selectedSubjectForModal}
        sections={selectedSubjectForModal?.sections || []}
        sectionQuizzes={sectionQuizzes}
        userId={user?.id}
        onSectionCreated={(newSec) => {
          setSections((prev) => [newSec, ...prev]);
        }}
        onArchiveSubject={handleArchiveSubject}
        onAddSection={(sub) => {
          setAddSectionSubject(sub);
        }}
      />

      {/* Modal to add a new section to an existing subject */}
      {addSectionSubject && (
        <CreateSectionButton
          userId={user?.id}
          preselectedSubject={addSectionSubject}
          isOpen={!!addSectionSubject}
          onClose={() => setAddSectionSubject(null)}
          onSectionCreated={(newSec) => {
            setSections((prev) => [newSec, ...prev]);
            setAddSectionSubject(null);
          }}
        />
      )}

      {/* Modal for editing section */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-brand-navy mb-4">
              Edit Subject
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Subject Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditModal(null)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editSaving}
                className="px-4 py-2 text-sm font-semibold bg-brand-gold text-brand-navy rounded-lg hover:bg-brand-gold-dark transition-colors disabled:opacity-50"
              >
                {editSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
