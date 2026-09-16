import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { SubjectRequestForm } from "./SubjectRequestForm.jsx";

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
      } catch (rpcErr) {}

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
        } catch (e) {}
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

    // Check if instructor is already assigned to this subject
    const subject = subjects.find(s => s.id === subjectId);
    
    if (subject && !subject.is_assigned) {
      // Assign instructor to the subject
      try {
        const { error: assignError } = await supabase.rpc("join_subject", {
          p_subject_id: subjectId,
        });

        if (assignError) throw assignError;

        // Update local state to reflect assignment
        setSubjects(prev => 
          prev.map(s => 
            s.id === subjectId ? { ...s, is_assigned: true } : s
          )
        );
      } catch (err) {
        console.error("Error assigning subject:", err);
        // Still allow selection even if assignment fails
      }
    }

    onSubjectSelect(returnFullObject ? subject : subjectId);
  };

  const handleRequestSubmitted = (result) => {
    // Refresh subjects list in case the request was approved (unlikely but possible)
    fetchSubjects();
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

  return (
    <div className={`w-full ${className}`}>
      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
        Curriculum Subject <span className="text-rose-500">*</span>
      </label>
      <div className="relative">
        <select
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
          
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
              {subject.code ? ` (${subject.code})` : ""}
              {` — ${getGradeLabel(subject.grade_level)}`}
              {subject.is_assigned ? " (Assigned)" : ""}
            </option>
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