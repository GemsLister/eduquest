import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../supabaseClient.js";
import { notify } from "../../utils/notify.jsx";
import { subjectService } from "../../services/subjectService.js";
import { useConfirm } from "../ui/ConfirmModal.jsx";
import { Skeleton } from "../ui/Skeleton.jsx";
import { useEscapeKey } from "../../hooks/useEscapeKey.jsx";
import { useFocusTrap } from "../../hooks/useFocusTrap.jsx";

const GRADE_LEVELS = ["1st", "2nd", "3rd", "4th"];
const PAGE_SIZE = 10;

const inputClass =
  "w-full px-3.5 py-2 border border-gray-300 rounded-lg text-xs text-brand-navy placeholder:text-slate-400 focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 transition-all";

/**
 * Department Head view of the curriculum: every subject, with edit,
 * archive and restore. Refreshes on the "subjects-changed" event.
 */
export const CurriculumSubjectsPanel = () => {
  const confirm = useConfirm();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [editing, setEditing] = useState(null); // subject being edited
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    fetchSubjects();
    window.addEventListener("subjects-changed", fetchSubjects);
    return () => window.removeEventListener("subjects-changed", fetchSubjects);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, gradeFilter, showArchived]);

  const fetchSubjects = async () => {
    try {
      const { data, error } = await supabase
        .from("subjects")
        .select("id, name, code, grade_level, description, is_archived, created_at")
        .order("name", { ascending: true });
      if (error) throw error;
      setSubjects(data || []);
    } catch (err) {
      console.error("Error loading subjects:", err);
      notify.error("Failed to load curriculum subjects.");
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return subjects.filter((s) => {
      if (!!s.is_archived !== showArchived) return false;
      if (gradeFilter !== "all" && s.grade_level !== gradeFilter) return false;
      if (!q) return true;
      return [s.name, s.code, s.description].some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [subjects, search, gradeFilter, showArchived]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginated = filtered.slice(startIndex, startIndex + PAGE_SIZE);
  const activeCount = subjects.filter((s) => !s.is_archived).length;
  const archivedCount = subjects.length - activeCount;

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  // Esc closes the edit modal
  useEscapeKey(() => {
    if (!saving) setEditing(null);
  }, Boolean(editing));
  const editTrapRef = useFocusTrap(Boolean(editing));

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    const name = editing.name.trim();
    if (!name) {
      notify.error("Subject name is required");
      return;
    }
    setSaving(true);
    try {
      const duplicate = await subjectService.findDuplicateSubject({
        name,
        code: editing.code,
        excludeId: editing.id,
      });
      if (duplicate) {
        notify.error(
          `Another subject already uses this ${duplicate.name.trim().toLowerCase() === name.toLowerCase() ? "name" : "code"}: ${duplicate.name}${duplicate.code ? ` (${duplicate.code})` : ""}.`,
        );
        return;
      }

      const { error } = await subjectService.updateSubject(editing.id, {
        name,
        code: editing.code?.trim() || null,
        grade_level: editing.grade_level || "1st",
        description: editing.description?.trim() || null,
      });
      if (error) throw error;

      notify.success("Subject updated.");
      setEditing(null);
      window.dispatchEvent(new CustomEvent("subjects-changed"));
    } catch (err) {
      console.error("Error updating subject:", err);
      notify.error(err.message || "Failed to update subject");
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveToggle = async (subject) => {
    const archiving = !subject.is_archived;
    const ok = await confirm({
      title: archiving ? "Archive subject?" : "Restore subject?",
      message: archiving
        ? `"${subject.name}" will be hidden from instructors' subject lists. Existing sections and quizzes are kept, and you can restore it later.`
        : `"${subject.name}" will be available to instructors again.`,
      confirmText: archiving ? "Archive" : "Restore",
      cancelText: "Cancel",
      variant: archiving ? "warning" : "success",
    });
    if (!ok) return;

    setBusyId(subject.id);
    try {
      if (!archiving) {
        const duplicate = await subjectService.findDuplicateSubject({
          name: subject.name,
          code: subject.code,
          excludeId: subject.id,
        });
        if (duplicate) {
          notify.error(
            `Can't restore: an active subject already uses this name or code (${duplicate.name}${duplicate.code ? `, ${duplicate.code}` : ""}).`,
          );
          return;
        }
      }
      const { error } = archiving
        ? await subjectService.archiveSubject(subject.id)
        : await subjectService.restoreSubject(subject.id);
      if (error) throw error;
      notify.success(archiving ? "Subject archived." : "Subject restored.");
      window.dispatchEvent(new CustomEvent("subjects-changed"));
    } catch (err) {
      console.error("Error archiving subject:", err);
      notify.error(err.message || "Failed to update subject");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 space-y-3" aria-label="Loading subjects">
        <Skeleton className="h-5 w-1/3 rounded-md" />
        <Skeleton className="h-3 w-2/3 rounded-md" />
        <Skeleton className="h-3 w-1/2 rounded-md" />
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {[
            { key: false, label: "Active", count: activeCount },
            { key: true, label: "Archived", count: archivedCount },
          ].map((tab) => (
            <button
              key={tab.label}
              onClick={() => setShowArchived(tab.key)}
              aria-pressed={showArchived === tab.key}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 border cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 ${
                showArchived === tab.key
                  ? "bg-brand-navy text-white border-brand-navy shadow-xs"
                  : "bg-white text-slate-700 border-slate-200 hover:border-brand-navy hover:text-brand-navy shadow-2xs"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  showArchived === tab.key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
          <label htmlFor="curriculum-grade" className="sr-only">
            Filter by year level
          </label>
          <select
            id="curriculum-grade"
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-brand-navy bg-white shadow-2xs focus:outline-none focus:ring-2 focus:ring-brand-gold/20 focus:border-brand-gold"
          >
            <option value="all">All Year Levels</option>
            {GRADE_LEVELS.map((g) => (
              <option key={g} value={g}>
                {g} Year
              </option>
            ))}
          </select>
        </div>

        <div className="relative flex-1 max-w-sm">
          <label htmlFor="curriculum-search" className="sr-only">
            Search subjects
          </label>
          <input
            id="curriculum-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, code, description..."
            className="w-full pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-lg text-xs text-brand-navy placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-gold/20 focus:border-brand-gold shadow-xs transition-all"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold text-sm rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Subjects List */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-400">
            {showArchived ? "No archived subjects." : "No subjects match this view."}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {paginated.map((subject) => (
              <div
                key={subject.id}
                className="p-5 hover:bg-slate-50/70 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className="font-bold text-brand-navy text-base">{subject.name}</h4>
                    {subject.code && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-100 text-slate-700 uppercase tracking-wider border border-slate-200">
                        {subject.code}
                      </span>
                    )}
                    <span className="text-xs font-semibold text-gray-500">
                      {subject.grade_level ? `${subject.grade_level} Year` : ""}
                    </span>
                  </div>
                  {subject.description && (
                    <p className="text-xs text-gray-600 max-w-2xl leading-relaxed line-clamp-2">
                      {subject.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                  {!subject.is_archived && (
                    <button
                      onClick={() => setEditing({ ...subject })}
                      aria-label={`Edit ${subject.name}`}
                      className="px-4 py-2 bg-white border border-slate-300 hover:border-brand-navy text-brand-navy text-xs font-bold rounded-lg transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    onClick={() => handleArchiveToggle(subject)}
                    disabled={busyId === subject.id}
                    aria-label={`${subject.is_archived ? "Restore" : "Archive"} ${subject.name}`}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 ${
                      subject.is_archived
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                  >
                    {busyId === subject.id ? "Working..." : subject.is_archived ? "Restore" : "Archive"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-4 p-4 border-t border-gray-200 text-xs font-semibold text-gray-600">
            <span>
              Showing <strong>{startIndex + 1}</strong>–
              <strong>{Math.min(startIndex + PAGE_SIZE, filtered.length)}</strong> of{" "}
              <strong>{filtered.length}</strong> subjects
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
              >
                Previous
              </button>
              <span className="px-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Subject Modal */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) setEditing(null);
          }}
        >
          <form
            onSubmit={handleSaveEdit}
            ref={editTrapRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-subject-title"
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-4"
          >
            <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <h3 id="edit-subject-title" className="text-lg font-bold text-brand-navy">
                Edit Subject
              </h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                disabled={saving}
                aria-label="Close edit subject"
                className="text-gray-400 hover:text-gray-600 font-bold text-lg p-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
              >
                ×
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="edit-subject-name" className="block text-xs font-bold text-gray-700 mb-1">
                  Subject Name *
                </label>
                <input
                  id="edit-subject-name"
                  value={editing.name || ""}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  required
                  autoFocus
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="edit-subject-code" className="block text-xs font-bold text-gray-700 mb-1">
                  Subject Code
                </label>
                <input
                  id="edit-subject-code"
                  value={editing.code || ""}
                  onChange={(e) => setEditing({ ...editing, code: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label htmlFor="edit-subject-grade" className="block text-xs font-bold text-gray-700 mb-1">
                Year Level *
              </label>
              <select
                id="edit-subject-grade"
                value={editing.grade_level || "1st"}
                onChange={(e) => setEditing({ ...editing, grade_level: e.target.value })}
                className={inputClass}
              >
                {GRADE_LEVELS.map((g) => (
                  <option key={g} value={g}>
                    {g} Year
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="edit-subject-description" className="block text-xs font-bold text-gray-700 mb-1">
                Description
              </label>
              <textarea
                id="edit-subject-description"
                rows={3}
                value={editing.description || ""}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                className={`${inputClass} resize-none`}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                disabled={saving}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-bold text-xs hover:bg-gray-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-brand-gold text-brand-navy rounded-lg font-bold text-xs hover:brightness-95 disabled:opacity-50 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
