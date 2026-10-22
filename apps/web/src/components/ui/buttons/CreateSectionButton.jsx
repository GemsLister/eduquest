import { useState } from "react";
import { sectionService } from "../../../services/sectionService.js";
import { supabase } from "../../../supabaseClient.js";
import { notify } from "../../../utils/notify.jsx";
import { useEscapeKey } from "../../../hooks/useEscapeKey.jsx";
import { CentralizedSubjectDropdown } from "../../CentralizedSubjectDropdown.jsx";
import { useFocusTrap } from "../../../hooks/useFocusTrap.jsx";

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

  useEscapeKey(() => {
    if (!loading) setShowForm(false);
  }, showForm);
  const trapRef = useFocusTrap(showForm);

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

      // Join the subject only now that the form is submitted
      if (!activeSubject.is_assigned && !preselectedSubject) {
        const { error: joinError } = await supabase.rpc("join_subject", {
          p_subject_id: activeSubject.id,
        });
        if (joinError) console.error("Error assigning subject:", joinError);
      }

      const { data: newSection, error: createError } =
        await sectionService.createSectionForSubject({
          instructorId: userId,
          subjectId: activeSubject.id || activeSubject.subject_id,
          subjectName: activeSubject.name,
          sectionCode: sectionName,
        });
      if (createError) throw createError;

      setSectionName("");
      setSelectedSubject(null);
      setShowForm(false);

      if (onSectionCreated) {
        onSectionCreated(newSection);
      }

      notify.success(
        preselectedSubject
          ? "Section created successfully!"
          : `${activeSubject.name} added with section ${sectionName.trim()}.`,
      );
    } catch (err) {
      setError(err.message || "Failed to create section");
      notify.error(err.message || "Failed to create section");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {externalIsOpen === undefined && (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-brand-gold text-brand-navy px-4 py-2.5 rounded-lg font-bold text-sm border border-brand-gold active:scale-98 hover:bg-brand-gold-dark hover:brightness-95 hover:shadow-lg active:brightness-90 transition-all duration-200 shadow-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          <span>Add Subject</span>
        </button>
      )}

      {showForm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setShowForm(false)}
          />
          <div
            ref={trapRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-section-title"
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-auto overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-brand-navy to-brand-indigo px-6 py-5 shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 id="create-section-title" className="text-xl font-black text-white">
                    {preselectedSubject
                      ? `Add Section to ${preselectedSubject.name}`
                      : "Add Subject"}
                  </h3>
                  <p className="text-white/70 text-xs mt-1">
                    {preselectedSubject
                      ? "Assign an additional section to this existing curriculum subject."
                      : "Pick a curriculum subject from the Department Head and add your first section."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  aria-label="Close create section form"
                  className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-5 h-5"
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
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="p-6 space-y-4 overflow-y-auto"
            >
              {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-xs font-semibold">
                  {error}
                </div>
              )}

              {preselectedSubject ? (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Curriculum Subject
                  </label>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <span className="font-bold text-sm text-brand-navy">
                      {preselectedSubject.name}
                    </span>
                    {preselectedSubject.code && (
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-brand-gold text-brand-navy rounded-full">
                        {preselectedSubject.code}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <CentralizedSubjectDropdown
                  selectedSubjectId={selectedSubject?.id}
                  onSubjectSelect={setSelectedSubject}
                  showRequestOption={true}
                  returnFullObject={true}
                />
              )}

              <div>
                <label htmlFor="create-section-name" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Section Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="create-section-name"
                  type="text"
                  value={sectionName}
                  onChange={(e) => setSectionName(e.target.value)}
                  placeholder="e.g., T390 or T23"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm text-brand-navy placeholder:text-slate-400 focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 transition-all"
                  disabled={loading}
                />
              </div>

              <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3.5 flex items-start gap-2.5 text-blue-900">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4 text-blue-600 shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-xs leading-relaxed text-blue-800">
                  Select a subject from the centralized list. If you need a new subject that isn't listed, choose <strong>"+ Request New Subject"</strong> to submit for Department Head approval.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-lg font-bold text-xs hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 bg-brand-gold text-brand-navy rounded-lg font-bold text-xs hover:bg-brand-gold-dark hover:brightness-95 hover:shadow-lg active:brightness-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md cursor-pointer flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
                >
                  {loading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-brand-navy border-t-transparent rounded-full animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>{preselectedSubject ? "Add Section" : "Add Subject"}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
