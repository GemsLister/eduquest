import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient.js";
import { notify } from "../utils/notify.jsx";

export const SubjectSectionModal = ({
  isOpen,
  onClose,
  subject,
  sections = [],
  sectionQuizzes = {},
  userId,
  onSectionCreated,
}) => {
  const navigate = useNavigate();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState("");
  const [localSections, setLocalSections] = useState(sections);

  // Sync localSections when sections prop changes
  React.useEffect(() => {
    setLocalSections(sections);
  }, [sections]);

  if (!isOpen || !subject) return null;

  const handleAddSectionSubmit = async (e) => {
    e.preventDefault();
    if (!newSectionName.trim()) {
      setFormError("Section name is required");
      return;
    }

    setAdding(true);
    setFormError("");

    try {
      const trimmedName = newSectionName.trim();
      const fullSectionName = `${subject.name} - ${trimmedName}`;
      const subjectIdToUse = subject.subject_id || subject.id;

      // 1. Duplicate check: Check if section with this full name is already assigned to this subject
      const { data: existingSection } = await supabase
        .from("sections")
        .select("id, name")
        .eq("instructor_id", userId)
        .eq("subject_id", subjectIdToUse)
        .ilike("name", fullSectionName)
        .maybeSingle();

      if (existingSection) {
        setFormError(`Section "${trimmedName}" is already assigned to ${subject.name}.`);
        setAdding(false);
        return;
      }

      const examCode = () =>
        Math.random().toString(36).substring(2, 8).toUpperCase();

      // 2. Create section record
      const { data, error: insertError } = await supabase
        .from("sections")
        .insert([
          {
            instructor_id: userId,
            name: fullSectionName,
            description: null,
            subject_id: subjectIdToUse,
            exam_code: examCode(),
          },
        ])
        .select();

      if (insertError) throw insertError;
      const createdSection = data[0];

      // 3. Create teaching_assignments record
      try {
        await supabase.from("teaching_assignments").insert([
          {
            instructor_id: userId,
            subject_id: subjectIdToUse,
            section_id: createdSection.id,
          },
        ]);
      } catch (taErr) {
        console.warn("Could not insert teaching assignment:", taErr);
      }

      // Update local state instantly
      const updatedList = [createdSection, ...localSections];
      setLocalSections(updatedList);
      setNewSectionName("");
      setShowAddForm(false);

      if (onSectionCreated) {
        onSectionCreated(createdSection);
      }

      notify.success(`Section "${trimmedName}" added to ${subject.name}!`);
    } catch (err) {
      console.error("Error adding section:", err);
      setFormError(err.message || "Failed to add section");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-navy to-brand-indigo p-6 text-white shrink-0 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl font-bold p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            ×
          </button>
          <div className="flex items-center gap-3 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-brand-gold text-brand-navy uppercase tracking-wider">
              {subject.code || "SUBJECT"}
            </span>
            <span className="text-white/60 text-xs font-semibold">
              {localSections.length} Assigned Section{localSections.length === 1 ? "" : "s"}
            </span>
          </div>
          <h2 className="text-2xl font-black text-white">{subject.name}</h2>
          {subject.description && (
            <p className="text-white/80 text-sm mt-1 line-clamp-2">
              {subject.description}
            </p>
          )}
        </div>

        {/* Body - Section List */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 bg-gray-50/50">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
              Assigned Sections ({localSections.length})
            </h3>
            <button
              onClick={() => {
                setShowAddForm(!showAddForm);
                setFormError("");
              }}
              className="text-xs font-bold bg-brand-navy text-white hover:bg-brand-indigo px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <span>{showAddForm ? "Cancel" : "+ Add Section"}</span>
            </button>
          </div>

          {/* Inline Add Section Form */}
          {showAddForm && (
            <form
              onSubmit={handleAddSectionSubmit}
              className="bg-white border-2 border-brand-navy/20 p-4 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200"
            >
              <div>
                <label className="block text-xs font-bold text-brand-navy uppercase tracking-wider mb-1">
                  New Section Name for {subject.name}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    placeholder="e.g., BSIT 3C"
                    autoFocus
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                  />
                  <button
                    type="submit"
                    disabled={adding}
                    className="px-4 py-2 bg-brand-gold text-brand-navy rounded-lg font-bold text-xs hover:bg-brand-gold-dark transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
                  >
                    {adding ? "Saving..." : "Save Assignment"}
                  </button>
                </div>
                {formError && (
                  <p className="text-xs text-red-600 font-semibold mt-1">
                    {formError}
                  </p>
                )}
                <p className="text-[11px] text-gray-500 mt-1">
                  This will assign section <strong>{newSectionName.trim() || "..."}</strong> to <strong>{subject.name}</strong> without creating duplicate subject records.
                </p>
              </div>
            </form>
          )}

          {localSections.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-xl p-8 text-center">
              <p className="text-gray-500 font-medium text-sm">
                No sections assigned to this subject yet.
              </p>
              <button
                onClick={() => setShowAddForm(true)}
                className="mt-3 px-4 py-2 bg-brand-gold text-brand-navy rounded-lg font-bold text-xs hover:bg-brand-gold-dark transition-colors cursor-pointer"
              >
                Assign First Section
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {localSections.map((sec) => {
                const quizzes = sectionQuizzes[sec.id] || [];
                const totalQuizzes = quizzes.length;
                const openQuizzes = quizzes.filter(
                  (q) => q.is_open !== false
                ).length;
                const totalAttempts = quizzes.reduce(
                  (sum, q) => sum + (q.attempts || 0),
                  0
                );

                // Extract clean display section name (e.g., "BSIT 3A")
                let displayName = sec.name || "";
                if (displayName.includes("-")) {
                  const parts = displayName.split("-");
                  displayName = parts[parts.length - 1].trim();
                }

                return (
                  <div
                    key={sec.id}
                    onClick={() => {
                      onClose();
                      navigate(`/instructor-dashboard/section/${sec.id}`);
                    }}
                    className="bg-white border border-gray-200 hover:border-brand-gold/60 rounded-xl p-4 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-base font-black text-brand-navy group-hover:text-brand-indigo transition-colors">
                          {displayName}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-brand-navy/5 text-brand-navy rounded-full">
                          Section
                        </span>
                      </div>
                      {sec.exam_code && (
                        <p className="text-xs text-gray-500 font-mono mb-3">
                          Exam Code: <span className="font-bold text-gray-700">{sec.exam_code}</span>
                        </p>
                      )}
                    </div>

                    {/* Stats summary */}
                    <div className="grid grid-cols-3 gap-1 pt-3 border-t border-gray-100 text-center">
                      <div>
                        <p className="text-xs font-extrabold text-brand-navy">
                          {openQuizzes}/{totalQuizzes}
                        </p>
                        <p className="text-[9px] text-gray-400 font-semibold uppercase">
                          Quizzes
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-extrabold text-brand-indigo">
                          {totalAttempts}
                        </p>
                        <p className="text-[9px] text-gray-400 font-semibold uppercase">
                          Attempts
                        </p>
                      </div>
                      <div className="flex items-center justify-end">
                        <span className="text-xs font-bold text-brand-gold group-hover:translate-x-0.5 transition-transform">
                          Open →
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
