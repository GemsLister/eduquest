import { useState, useMemo, useEffect } from "react";
import { notify } from "../../utils/notify.jsx";
import { useConfirm } from "../../components/ui/ConfirmModal.jsx";
import { CreateSectionButton } from "../../components/ui/buttons/CreateSectionButton.jsx";
import { useFetchSectionQuiz } from "../../hooks/quizHook/useFetchSectionQuiz.jsx";
import { sectionService } from "../../services/sectionService.js";
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

  // Load archived sections when toggle is turned on
  const handleToggleArchived = async () => {
    if (!showArchived && archivedSections.length === 0) {
      setArchivedLoading(true);
      try {
        const { data } = await supabase
          .from("sections")
          .select("*")
          .eq("instructor_id", user?.id)
          .eq("is_archived", true)
          .order("created_at", { ascending: false });
        setArchivedSections(data || []);
      } catch (err) {
        console.error("Error loading archived sections:", err);
      } finally {
        setArchivedLoading(false);
      }
    }
    setShowArchived(!showArchived);
  };

  const handleArchiveSection = async (sectionId, sectionName) => {
    const confirmed = await confirm({
      title: "Archive Section",
      message: `Archive "${sectionName}"? You can restore it later from the Archived tab.`,
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
      notify.success("Subject restored!");
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

  return (
    <>
      {/* Hero Banner */}
      <div className="bg-brand-navy px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-brand-gold text-sm font-semibold uppercase tracking-widest mb-1">
              Instructor Dashboard
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
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search subjects or sections..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold transition-all shadow-xs"
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"
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
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleArchived}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                showArchived
                  ? "bg-brand-navy text-white border-brand-navy shadow-sm"
                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
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
              Archived
              {archivedSections.length > 0 && (
                <span
                  className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                    showArchived
                      ? "bg-white/25 text-white"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {archivedSections.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Normalized Subject Cards */}
        {filteredSubjects.length === 0 && !showArchived ? (
          <ClassCard.EmptyClassSection
            title={search.trim() ? "No Subjects Found" : "No Subjects Taught Yet"}
            icon={search.trim() ? "🔍" : "📚"}
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
                        <div className="relative z-[1] w-full">
                          <div className="flex items-center justify-between gap-2 mb-1">
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
                              let secDisplayName = sec.name || "";
                              if (secDisplayName.includes("-")) {
                                const parts = secDisplayName.split("-");
                                secDisplayName = parts[parts.length - 1].trim();
                              }
                              return (
                                <span
                                  key={sec.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedSubjectForModal(sub);
                                  }}
                                  className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-gray-100 text-gray-700 hover:bg-brand-navy hover:text-white transition-colors cursor-pointer"
                                >
                                  {secDisplayName}
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
                          className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${theme.button}`}
                        >
                          <span>View Sections ({sub.sections.length})</span>
                          <span className="text-sm font-bold">→</span>
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

        {/* Archived Sections */}
        {showArchived && (
          <div className="mt-8">
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
              Archived Subjects
            </h2>
            {archivedLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400"></div>
              </div>
            ) : filteredArchived.length === 0 ? (
              <div className="bg-white rounded-lg p-8 text-center shadow-sm border border-gray-200">
                <p className="text-gray-500 text-sm">
                  {search.trim()
                    ? "No archived subjects match your search."
                    : "No archived subjects."}
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {paginatedArchived.map((section) => (
                    <div
                      key={section.id}
                      className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center justify-between opacity-70"
                    >
                      <div>
                        <h3 className="font-bold text-gray-700">
                          {section.name}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {section.description || "No subject"}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRestoreSection(section.id)}
                        className="px-3 py-1.5 bg-brand-gold text-brand-navy text-xs font-semibold rounded-lg hover:bg-brand-gold-dark transition-colors"
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
