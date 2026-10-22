import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { SubjectRequestForm } from "./SubjectRequestForm.jsx";

const YEAR_LEVELS = ["1st", "2nd", "3rd", "4th"];

export const CentralizedSubjectDropdown = ({
  selectedSubjectId,
  onSubjectSelect,
  showRequestOption = true,
  filterByGradeLevel = null,
  className = "",
  returnFullObject = false,
}) => {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [addedFilter, setAddedFilter] = useState("all");

  useEffect(() => {
    fetchSubjects();
    window.addEventListener("subjects-changed", fetchSubjects);
    return () => window.removeEventListener("subjects-changed", fetchSubjects);
  }, [filterByGradeLevel]);

  const fetchSubjects = async () => {
    try {
      setLoading(true);
      setError("");

      let loadedSubjects = [];

      // 1. Try RPC
      try {
        const { data, error: rpcError } = await supabase.rpc("get_approved_subjects");
        if (!rpcError && data) {
          loadedSubjects = data;
        }
      } catch { /* fall through to the next source */ }

      // 2. Direct table fallback if RPC returns empty or fails
      if (loadedSubjects.length === 0) {
        try {
          const { data: subData } = await supabase
            .from("subjects")
            .select("*")
            .eq("is_archived", false)
            .order("name", { ascending: true });

          if (subData) {
            loadedSubjects = subData;
          }
        } catch { /* fall through to the next source */ }
      }

      // Filter out any pending or rejected subject requests
      let filteredSubjects = (loadedSubjects || []).filter((s) => {
        const desc = s.description || "";
        const isPending =
          desc.includes("[REQUEST:PENDING") ||
          (s.status || "").toLowerCase() === "pending";
        const isRejected =
          desc.includes("[REQUEST:REJECTED") ||
          (s.status || "").toLowerCase() === "rejected";
        return !isPending && !isRejected;
      });

      // Filter by grade level if specified
      if (filterByGradeLevel) {
        filteredSubjects = filteredSubjects.filter(
          (s) => s.grade_level === filterByGradeLevel,
        );
      }

      setSubjects(filteredSubjects);
    } catch (err) {
      console.error("Error fetching subjects:", err);
      setError("Failed to load subjects");
      setSubjects([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubjectSelect = async (subjectId) => {
    if (subjectId === "request_new") {
      setShowRequestForm(true);
      return;
    }

    if (subjectId === null) {
      onSubjectSelect(null);
      return;
    }

    // Joining the subject happens on submit, so cancelling leaves no assignment behind
    const subject = subjects.find((s) => s.id === subjectId);
    onSubjectSelect(returnFullObject ? subject : subjectId);
  };

  const handleRequestSubmitted = () => {
    // Refresh subjects list and notify dashboard listeners
    fetchSubjects();
    window.dispatchEvent(new CustomEvent("subject-requests-changed"));
    window.dispatchEvent(new CustomEvent("pending-subject-requests-changed"));
  };

  const getGradeLabel = (gradeLevel) => {
    const labels = {
      '1st': '1st Year',
      '2nd': '2nd Year', 
      '3rd': '3rd Year',
      '4th': '4th Year',
    };
    return labels[gradeLevel] || gradeLevel;
  };

  if (loading) {
    return (
      <div className={`w-full ${className}`}>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Select Subject
        </label>
        <div className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-500">
          Loading subjects...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`w-full ${className}`}>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Select Subject
        </label>
        <div className="w-full px-4 py-2.5 border border-red-300 rounded-lg bg-red-50 text-sm text-red-600">
          {error}
        </div>
      </div>
    );
  }

  const term = search.trim().toLowerCase();
  const visibleSubjects = subjects.filter((s) => {
    // Keep the current pick in the list so the select never loses its value
    if (s.id === selectedSubjectId) return true;
    if (yearFilter !== "all" && s.grade_level !== yearFilter) return false;
    if (addedFilter === "new" && s.is_assigned) return false;
    if (addedFilter === "added" && !s.is_assigned) return false;
    if (term && !`${s.name} ${s.code || ""}`.toLowerCase().includes(term)) return false;
    return true;
  });
  const yearOptions = YEAR_LEVELS.filter((y) => subjects.some((s) => s.grade_level === y));
  // Options grouped by year level, any unexpected level last
  const otherYears = [...new Set(subjects.map((s) => s.grade_level || ""))].filter(
    (y) => !YEAR_LEVELS.includes(y),
  );
  const yearGroups = [...yearOptions, ...otherYears]
    .map((year) => ({ year, items: visibleSubjects.filter((s) => (s.grade_level || "") === year) }))
    .filter((g) => g.items.length > 0);
  const filtersActive = term || yearFilter !== "all" || addedFilter !== "all";

  const chipClass = (active) =>
    `px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 ${
      active
        ? "bg-brand-navy text-white border-brand-navy"
        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
    }`;

  return (
    <div className={`w-full ${className}`}>
      <label htmlFor="subject-picker" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
        Curriculum Subject <span className="text-rose-500">*</span>
      </label>

      {subjects.length > 0 && (
        <div className="space-y-2 mb-2.5">
          <div className="relative">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by subject name or code..."
              aria-label="Search curriculum subjects"
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-brand-navy placeholder:text-slate-400 focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 transition-all"
            />
          </div>
          {yearOptions.length > 1 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by year level">
              <button type="button" onClick={() => setYearFilter("all")} aria-pressed={yearFilter === "all"} className={chipClass(yearFilter === "all")}>
                All Years
              </button>
              {yearOptions.map((y) => (
                <button key={y} type="button" onClick={() => setYearFilter(y)} aria-pressed={yearFilter === y} className={chipClass(yearFilter === y)}>
                  {getGradeLabel(y)}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by whether you teach the subject">
            {[
              ["all", "All Subjects"],
              ["new", "Not Yet Added"],
              ["added", "Already Teaching"],
            ].map(([value, label]) => (
              <button key={value} type="button" onClick={() => setAddedFilter(value)} aria-pressed={addedFilter === value} className={chipClass(addedFilter === value)}>
                {label}
              </button>
            ))}
            {filtersActive && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setYearFilter("all");
                  setAddedFilter("all");
                }}
                className="ml-auto text-[11px] font-semibold text-brand-gold-dark hover:text-brand-gold rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      <div className="relative">
        <select
          id="subject-picker"
          value={selectedSubjectId || ""}
          onChange={(e) => handleSubjectSelect(e.target.value || null)}
          className="w-full pl-4 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-gold/50 text-sm font-medium text-slate-800 transition-all appearance-none cursor-pointer"
        >
          <option value="">-- Select a Curriculum Subject --</option>

          {subjects.length === 0 && (
            <option value="" disabled>
              No approved curriculum subjects available
            </option>
          )}
          {subjects.length > 0 && visibleSubjects.length === 0 && (
            <option value="" disabled>
              No subjects match these filters
            </option>
          )}

          {yearGroups.map((group) => (
            <optgroup key={group.year || "none"} label={getGradeLabel(group.year) || "No year level"}>
              {group.items.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                  {subject.code ? ` (${subject.code})` : ""}
                  {subject.is_assigned ? " · Already teaching" : ""}
                </option>
              ))}
            </optgroup>
          ))}

          {showRequestOption && (
            <option value="request_new" className="font-bold text-brand-indigo">
              + Request New Subject
            </option>
          )}
        </select>
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {subjects.length > 0 && (
        <p className="text-[11px] text-slate-500 mt-1.5">
          {filtersActive
            ? `Showing ${visibleSubjects.length} of ${subjects.length} subjects`
            : `${subjects.length} curriculum ${subjects.length === 1 ? "subject" : "subjects"} from the Department Head`}
        </p>
      )}

      {showRequestForm && (
        <SubjectRequestForm
          isOpen={showRequestForm}
          onClose={() => setShowRequestForm(false)}
          onRequestSubmitted={handleRequestSubmitted}
        />
      )}
    </div>
  );
};