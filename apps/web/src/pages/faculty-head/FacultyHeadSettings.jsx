import { useState, useEffect } from "react";
import { notify } from "../../utils/notify.jsx";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../context/AuthContext";

export const FacultyHeadSettings = () => {
  const { user } = useAuth();
  const [reviewerName, setReviewerName] = useState("");
  const [approverName, setApproverName] = useState("");
  const [semesterOverride, setSemesterOverride] = useState("");
  const [schoolYearOverride, setSchoolYearOverride] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSignatories();
  }, [user]);

  const loadSignatories = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from("tos_signatories")
        .select("reviewer_name, approver_name, semester_override, school_year_override")
        .eq("faculty_head_id", user.id)
        .maybeSingle();

      if (data) {
        setReviewerName(data.reviewer_name || "");
        setApproverName(data.approver_name || "");
        setSemesterOverride(data.semester_override || "");
        setSchoolYearOverride(data.school_year_override || "");
      }
    } catch {
      // No existing record — that's fine
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("tos_signatories").upsert(
        {
          faculty_head_id: user.id,
          reviewer_name: reviewerName.trim(),
          approver_name: approverName.trim(),
          semester_override: semesterOverride.trim() || null,
          school_year_override: schoolYearOverride.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "faculty_head_id" }
      );

      if (error) throw error;
      notify.success("Signatories and academic settings saved successfully!");
    } catch (err) {
      console.error("Error saving signatories:", err);
      notify.error("Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-navy mb-3" />
        <p className="text-xs text-gray-400 font-semibold">Loading settings...</p>
      </div>
    );
  }

  return (
    <>
      {/* Hero Header Banner consistent with Department Head navigation */}
      <div className="bg-gradient-to-r from-brand-navy to-brand-indigo px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-brand-gold text-sm font-semibold uppercase tracking-widest mb-1">
              Department Head
            </p>
            <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
              Settings
            </h1>
            <p className="text-white/60 text-sm mt-1">
              Configure signatory names, academic calendar overrides, and PDF export parameters.
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="self-start sm:self-auto px-5 py-2.5 bg-brand-gold hover:bg-brand-gold-dark text-brand-navy font-bold rounded-xl text-xs transition-all shadow-xs disabled:opacity-50 flex items-center gap-2 cursor-pointer active:scale-98"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span>{saving ? "Saving..." : "Save Changes"}</span>
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="max-w-3xl space-y-6">
          {/* Card 1: TOS PDF Signatories */}
          <div className="bg-white rounded-2xl shadow-xs border border-gray-200 p-6 hover:shadow-sm transition-all">
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
              <div className="w-10 h-10 rounded-xl bg-brand-navy/10 text-brand-navy flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-brand-navy">
                  TOS PDF Signatories
                </h2>
                <p className="text-xs text-gray-500">
                  Names of reviewing and approving signatories printed on Table of Specifications (TOS) PDFs.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                  Reviewed by (Senior Faculty)
                </label>
                <input
                  type="text"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  placeholder="e.g. Joan Marie M. Panes"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold outline-none transition-all shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                  Approved by (Department Head)
                </label>
                <input
                  type="text"
                  value={approverName}
                  onChange={(e) => setApproverName(e.target.value)}
                  placeholder="e.g. Dr. Sales G. Aribe Jr."
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold outline-none transition-all shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Semester & School Year Override */}
          <div className="bg-white rounded-2xl shadow-xs border border-gray-200 p-6 hover:shadow-sm transition-all">
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-brand-navy">
                  Semester & School Year Override
                </h2>
                <p className="text-xs text-gray-500">
                  Override default calendar values on exported PDFs. Leave blank to auto-detect.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                  Semester
                </label>
                <select
                  value={semesterOverride}
                  onChange={(e) => setSemesterOverride(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold outline-none transition-all shadow-2xs bg-white"
                >
                  <option value="">Auto-detect (Current Academic Calendar)</option>
                  <option value="1st Semester">1st Semester</option>
                  <option value="2nd Semester">2nd Semester</option>
                  <option value="Summer">Summer / Midyear</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                  School Year
                </label>
                <input
                  type="text"
                  value={schoolYearOverride}
                  onChange={(e) => setSchoolYearOverride(e.target.value)}
                  placeholder="e.g., 2026-2027 (leave blank to auto-detect)"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold outline-none transition-all shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* Bottom Save Action */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-brand-gold hover:bg-brand-gold-dark text-brand-navy font-bold text-xs rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer active:scale-98 flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>{saving ? "Saving Changes..." : "Save Settings"}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
