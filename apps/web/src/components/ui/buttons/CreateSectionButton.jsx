import { useState } from "react";
import { supabase } from "../../../supabaseClient";
import { notify } from "../../../utils/notify.jsx";
import { CentralizedSubjectDropdown } from "../../CentralizedSubjectDropdown.jsx";

export const CreateSectionButton = ({ onSectionCreated, userId, preselectedSubject, isOpen: externalIsOpen, onClose: externalOnClose }) => {
  const [internalShowForm, setInternalShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(preselectedSubject || null);
  const [sectionName, setSectionName] = useState("");
  const [error, setError] = useState("");

  const showForm = externalIsOpen !== undefined ? externalIsOpen : internalShowForm;
  const setShowForm = (val) => {
    if (externalOnClose && !val) externalOnClose();
    setInternalShowForm(val);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const activeSubject = selectedSubject || preselectedSubject;
      if (!activeSubject) {
        setError("Please select a subject");
        return;
      }

      if (!sectionName.trim()) {
        setError("Section name is required");
        return;
      }

      const examCode = () =>
        Math.random().toString(36).substring(2, 8).toUpperCase();

      // Combine subject name with section name
      const fullSectionName = `${activeSubject.name} - ${sectionName.trim()}`;
      const subjectIdToUse = activeSubject.id || activeSubject.subject_id;

      // Duplicate check: ensure section is not assigned twice to same subject
      const { data: existingSection } = await supabase
        .from("sections")
        .select("id, name")
        .eq("instructor_id", userId)
        .eq("subject_id", subjectIdToUse)
        .ilike("name", fullSectionName)
        .maybeSingle();

      if (existingSection) {
        setError(`Section "${sectionName.trim()}" is already assigned to ${activeSubject.name}.`);
        setLoading(false);
        return;
      }

      const { data, error: insertError } = await supabase
        .from("sections")
        .insert([
          {
            instructor_id: userId,
            name: fullSectionName,
            description: null,
            subject_id: activeSubject.id,
            exam_code: examCode(),
          },
        ])
        .select();

      if (insertError) throw insertError;
      const newSection = data[0];

      // Also record in teaching_assignments table
      try {
        await supabase.from("teaching_assignments").insert([
          {
            instructor_id: userId,
            subject_id: activeSubject.id,
            section_id: newSection.id,
          },
        ]);
      } catch (taErr) {
        console.warn("Could not insert teaching assignment:", taErr);
      }

      setSectionName("");
      setSelectedSubject(null);
      setShowForm(false);

      if (onSectionCreated) {
        onSectionCreated(newSection);
      }

      notify.success("Section created successfully!");
    } catch (err) {
      setError(err.message || "Failed to create section");
      notify.error("Failed to create section");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowForm(true)}
        className="flex items-center gap-2 bg-brand-gold text-brand-navy px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-brand-gold-dark transition-all duration-200 shadow-md"
      >
        <span className="text-lg leading-none">+</span>
        New Subject
      </button>

      {showForm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowForm(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-brand-navy to-brand-indigo px-6 py-5 shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold text-white">
                    Create New Subject
                  </h3>
                  <p className="text-white/70 text-sm mt-1">
                    Create a subject for your section assignment.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  aria-label="Close create section form"
                  className="text-white/80 hover:text-white text-2xl leading-none font-semibold transition-colors"
                >
                  ×
                </button>
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="p-6 space-y-4 overflow-y-auto"
            >
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <CentralizedSubjectDropdown
                selectedSubjectId={selectedSubject?.id}
                onSubjectSelect={setSelectedSubject}
                showRequestOption={true}
                returnFullObject={true}
              />

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Section Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={sectionName}
                  onChange={(e) => setSectionName(e.target.value)}
                  placeholder="e.g., Section A"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold text-sm"
                  disabled={loading}
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-700">
                  <strong>Note:</strong> Select a subject from the centralized list. 
                  If you need a new subject, click "+ Request New Subject" and submit a request for Department Head approval.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 bg-brand-gold text-brand-navy rounded-lg font-semibold hover:bg-brand-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Creating..." : "Create Subject"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
