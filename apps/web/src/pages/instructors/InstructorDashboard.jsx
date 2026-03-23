import { useState, useMemo } from "react";
import { toast } from "react-toastify";
import { CreateSectionButton } from "../../components/ui/buttons/CreateSectionButton.jsx";
import { useFetchSectionQuiz } from "../../hooks/quizHook/useFetchSectionQuiz.jsx";
import { sectionService } from "../../services/sectionService.js";
import { supabase } from "../../supabaseClient.js";
import * as Container from "../../components/container/containers.js";
import * as ClassCard from "../../pages/instructors/ClassSections/classIndex.js";

export const InstructorDashboard = () => {
  const {
    user,
    sections = [],
    setSections,
    sectionQuizzes,
    loading,
  } = useFetchSectionQuiz();

  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [archivedSections, setArchivedSections] = useState([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [editName, setEditName] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editSaving, setEditSaving] = useState(false);

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
    if (!window.confirm(`Archive "${sectionName}"? You can restore it later from the Archived tab.`)) return;

    try {
      const { error } = await sectionService.archiveSection(sectionId);
      if (error) throw error;

      const archived = sections.find((s) => s.id === sectionId);
      setSections((prev) => prev.filter((s) => s.id !== sectionId));
      if (archived) {
        setArchivedSections((prev) => [archived, ...prev]);
      }
      toast.success(`"${sectionName}" archived!`);
    } catch (err) {
      toast.error("Failed to archive section: " + err.message);
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
      toast.success("Subject restored!");
    } catch (err) {
      toast.error("Failed to restore section: " + err.message);
    }
  };

  const handleEditSection = (section) => {
    setEditModal(section);
    setEditName(section.name || "");
    setEditSubject(section.description || "");
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      toast.error("Course name is required");
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
      toast.success("Subject updated!");
      setEditModal(null);
    } catch (err) {
      toast.error("Failed to update section: " + err.message);
    } finally {
      setEditSaving(false);
    }
  };

  // Filter sections by search
  const filteredSections = useMemo(() => {
    if (!search.trim()) return sections;
    const q = search.trim().toLowerCase();
    return sections.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q),
    );
  }, [sections, search]);

  const filteredArchived = useMemo(() => {
    if (!search.trim()) return archivedSections;
    const q = search.trim().toLowerCase();
    return archivedSections.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q),
    );
  }, [archivedSections, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand-gold"></div>
          <p className="mt-4 text-brand-navy font-semibold">Loading...</p>
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
              Instructor
            </p>
            <h1 className="text-2xl md:text-3xl font-black text-white">
              Your Subjects
            </h1>
            <p className="text-white/50 text-sm mt-1">
              {sections.length} {sections.length === 1 ? "subject" : "subjects"}{" "}
              active
            </p>
          </div>
          <CreateSectionButton
            onSectionCreated={(newSections) =>
              setSections((prev) => [newSections, ...prev])
            }
            userId={user?.id}
          />
        </div>
      </div>

      <div className="p-6">
        {/* Search + Archive Toggle */}
        {(sections.length > 0 || archivedSections.length > 0) && (
          <div className="mb-6 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            {/* Search Bar */}
            <div className="relative flex-1 max-w-sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
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
                placeholder="Search subjects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-full text-sm focus:outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/20 bg-white"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Archive Toggle */}
            <button
              onClick={handleToggleArchived}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                showArchived
                  ? "bg-gray-700 text-white"
                  : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
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
        )}

        {/* Active Sections */}
        {filteredSections.length === 0 && !showArchived ? (
          <ClassCard.EmptyClassSection
            title={search.trim() ? "No Subjects Found" : "No Subjects Found"}
            icon={search.trim() ? "🔍" : "📚"}
          />
        ) : (
          <Container.ContentContainer>
            {filteredSections.map((section) => (
              <Container.SectionContainer key={section.id}>
                <ClassCard.ClassInfo
                  sectionId={section.id}
                  sectionName={section.name}
                  subject={section.description}
                  quizzes={sectionQuizzes[section.id] || []}
                  onEdit={() => handleEditSection(section)}
                  onArchive={() =>
                    handleArchiveSection(section.id, section.name)
                  }
                />
              </Container.SectionContainer>
            ))}
          </Container.ContentContainer>
        )}

        {/* Archived Sections */}
        {showArchived && (
          <div className="mt-8">
            <h2 className="text-lg font-bold text-gray-600 mb-4 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredArchived.map((section) => (
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
            )}
          </div>
        )}
      </div>

      {/* Edit Section Modal */}
      {editModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setEditModal(null)}
          />
          <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-gray-800 mb-1">
              Edit Subject
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Update subject details.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Course Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/20"
                  placeholder="e.g., Application Development"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Section / Schedule
                </label>
                <input
                  type="text"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/20"
                  placeholder="e.g., T301 - 2nd Sem 25-26"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-200">
              <button
                onClick={() => setEditModal(null)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editSaving || !editName.trim()}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-brand-navy hover:bg-brand-indigo transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
