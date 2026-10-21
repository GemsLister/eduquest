import { useState, useEffect } from "react";
import { useBlocker } from "react-router-dom";
import { notify } from "../../utils/notify.jsx";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { Skeleton } from "../../components/ui/Skeleton.jsx";
import { useConfirm } from "../../components/ui/ConfirmModal.jsx";

// "2026-2027": four digits, a dash, and the following year
const validateSchoolYear = (value) => {
  const v = value.trim();
  if (!v) return null;
  const m = v.match(/^(\d{4})\s*[-–]\s*(\d{4})$/);
  if (!m) return "Use the format YYYY-YYYY, e.g. 2026-2027.";
  if (Number(m[2]) !== Number(m[1]) + 1) return "The second year must follow the first (e.g. 2026-2027).";
  return null;
};

export const FacultyHeadSettings = () => {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [reviewerName, setReviewerName] = useState("");
  const [approverName, setApproverName] = useState("");
  const [semesterOverride, setSemesterOverride] = useState("");
  const [schoolYearOverride, setSchoolYearOverride] = useState("");
  const [savedValues, setSavedValues] = useState({
    reviewerName: "",
    approverName: "",
    semesterOverride: "",
    schoolYearOverride: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const schoolYearError = validateSchoolYear(schoolYearOverride);
  const isDirty =
    reviewerName !== savedValues.reviewerName ||
    approverName !== savedValues.approverName ||
    semesterOverride !== savedValues.semesterOverride ||
    schoolYearOverride !== savedValues.schoolYearOverride;

  // Warn before leaving the page with unsaved changes (in-app navigation)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    confirm({
      title: "Discard unsaved changes?",
      confirmText: "Discard & Leave",
      cancelText: "Stay",
      variant: "warning",
    }).then((leave) => (leave ? blocker.proceed() : blocker.reset()));
  }, [blocker.state]);

  // ...and for closing or reloading the tab
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

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
        const loaded = {
          reviewerName: data.reviewer_name || "",
          approverName: data.approver_name || "",
          semesterOverride: data.semester_override || "",
          schoolYearOverride: data.school_year_override || "",
        };
        setReviewerName(loaded.reviewerName);
        setApproverName(loaded.approverName);
        setSemesterOverride(loaded.semesterOverride);
        setSchoolYearOverride(loaded.schoolYearOverride);
        setSavedValues(loaded);
      }
    } catch {
      // No existing record — that's fine
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (schoolYearError) {
      notify.error(schoolYearError);
      return;
    }
    setSaving(true);
    try {
      // Normalize "2026 – 2027" to "2026-2027"
      const schoolYear = schoolYearOverride.trim().replace(/\s*[-–]\s*/, "-");
      const { error } = await supabase.from("tos_signatories").upsert(
        {
          faculty_head_id: user.id,
          reviewer_name: reviewerName.trim(),
          approver_name: approverName.trim(),
          semester_override: semesterOverride.trim() || null,
          school_year_override: schoolYear || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "faculty_head_id" }
      );

      if (error) throw error;
      const saved = {
        reviewerName: reviewerName.trim(),
        approverName: approverName.trim(),
        semesterOverride: semesterOverride.trim(),
        schoolYearOverride: schoolYear,
      };
      setReviewerName(saved.reviewerName);
      setApproverName(saved.approverName);
      setSemesterOverride(saved.semesterOverride);
      setSchoolYearOverride(saved.schoolYearOverride);
      setSavedValues(saved);
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
      <div className="flex-1 overflow-auto bg-authentic-white" aria-label="Loading settings">
        <div className="bg-gradient-to-r from-brand-navy to-brand-indigo px-6 py-8">
          <Skeleton tone="bg-white/20" className="h-4 w-36 rounded-md mb-2" />
          <Skeleton tone="bg-white/20" className="h-8 w-40 max-w-full rounded-md mb-2" />
          <Skeleton tone="bg-white/20" className="h-4 w-80 max-w-full rounded-md" />
        </div>
        <div className="p-6">
          <div className="max-w-3xl space-y-6">
            <div className="bg-white rounded-2xl shadow-xs border border-gray-200 p-6 space-y-4">
              <Skeleton className="h-5 w-48 rounded-md" />
              <Skeleton className="h-11 w-full rounded-lg" />
              <Skeleton className="h-11 w-full rounded-lg" />
            </div>
            <div className="bg-white rounded-2xl shadow-xs border border-gray-200 p-6 space-y-4">
              <Skeleton className="h-5 w-56 rounded-md" />
              <Skeleton className="h-11 w-full rounded-lg" />
              <Skeleton className="h-11 w-full rounded-lg" />
            </div>
          </div>
        </div>
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

          {isDirty && (
            <span className="self-start sm:self-auto flex items-center gap-2 px-3 py-1.5 bg-yellow-400/20 border border-yellow-400/30 rounded-full text-xs font-bold text-yellow-200">
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              Unsaved changes
            </span>
          )}
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
                <label htmlFor="settings-reviewer" className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                  Reviewed by
                </label>
                <input
                  id="settings-reviewer"
                  type="text"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  placeholder="e.g. Joan Marie M. Panes"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-xs text-brand-navy placeholder:text-slate-400 focus:ring-2 focus:ring-brand-gold/20 focus:border-brand-gold outline-none transition-all shadow-2xs"
                />
              </div>

              <div>
                <label htmlFor="settings-approver" className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                  Approved by (Department Head)
                </label>
                <input
                  id="settings-approver"
                  type="text"
                  value={approverName}
                  onChange={(e) => setApproverName(e.target.value)}
                  placeholder="e.g. Dr. Sales G. Aribe Jr."
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-xs text-brand-navy placeholder:text-slate-400 focus:ring-2 focus:ring-brand-gold/20 focus:border-brand-gold outline-none transition-all shadow-2xs"
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
                <label htmlFor="settings-semester" className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                  Semester
                </label>
                <select
                  id="settings-semester"
                  value={semesterOverride}
                  onChange={(e) => setSemesterOverride(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-xs text-brand-navy focus:ring-2 focus:ring-brand-gold/20 focus:border-brand-gold outline-none transition-all shadow-2xs bg-white"
                >
                  <option value="">Auto-detect (Current Academic Calendar)</option>
                  <option value="1st Semester">1st Semester</option>
                  <option value="2nd Semester">2nd Semester</option>
                  <option value="Summer">Summer / Midyear</option>
                </select>
              </div>

              <div>
                <label htmlFor="settings-school-year" className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                  School Year
                </label>
                <input
                  id="settings-school-year"
                  type="text"
                  value={schoolYearOverride}
                  onChange={(e) => setSchoolYearOverride(e.target.value)}
                  placeholder="e.g., 2026-2027 (leave blank to auto-detect)"
                  aria-invalid={!!schoolYearError}
                  aria-describedby={schoolYearError ? "settings-school-year-error" : undefined}
                  className={`w-full px-4 py-2.5 border rounded-lg text-xs text-brand-navy placeholder:text-slate-400 focus:ring-2 outline-none transition-all shadow-2xs ${
                    schoolYearError
                      ? "border-rose-300 focus:ring-rose-200 focus:border-rose-400"
                      : "border-slate-200 focus:ring-brand-gold/20 focus:border-brand-gold"
                  }`}
                />
                {schoolYearError && (
                  <p id="settings-school-year-error" className="text-[11px] text-rose-600 mt-1">
                    {schoolYearError}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Card 3: How it prints */}
          <div className="bg-white rounded-2xl shadow-xs border border-gray-200 p-6">
            <h2 className="text-base font-bold text-brand-navy mb-1">PDF Preview</h2>
            <p className="text-xs text-gray-500 mb-4">
              How these values appear on exported TOS PDFs.
            </p>
            <div className="border border-dashed border-slate-300 rounded-xl p-5 bg-slate-50/60">
              <p className="text-center text-[11px] font-semibold text-slate-600 mb-5">
                {semesterOverride || "Current Semester"}, School Year{" "}
                {schoolYearOverride.trim() && !schoolYearError
                  ? schoolYearOverride.trim().replace(/\s*[-–]\s*/, "-")
                  : "(auto-detected)"}
              </p>
              <div className="grid grid-cols-2 gap-6 text-center">
                {[
                  { role: "Reviewed by", name: reviewerName },
                  { role: "Approved by", name: approverName },
                ].map((s) => (
                  <div key={s.role}>
                    <p className="text-[10px] text-slate-500 text-left mb-6">{s.role}:</p>
                    <p className={`text-xs font-bold uppercase border-b border-slate-400 pb-1 ${s.name.trim() ? "text-slate-800" : "text-slate-300"}`}>
                      {s.name.trim() || "Not set"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Save Action */}
          <div className="flex items-center justify-end gap-3 pt-2">
            {!isDirty && !saving && (
              <span className="text-xs text-gray-400">All changes saved</span>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !isDirty || !!schoolYearError}
              className="px-6 py-2.5 bg-brand-gold hover:bg-brand-gold-dark hover:brightness-95 hover:shadow-lg active:brightness-90 text-brand-navy font-bold text-xs rounded-lg transition-all shadow-xs disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 flex items-center gap-2"
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
