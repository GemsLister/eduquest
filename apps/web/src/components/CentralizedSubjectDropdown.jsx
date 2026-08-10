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
  }, [filterByGradeLevel]);

  const fetchSubjects = async () => {
    try {
      setLoading(true);
      setError("");

      const { data, error: rpcError } = await supabase.rpc("get_approved_subjects");

      if (rpcError) {
        // If the function doesn't exist yet (migration not run), show helpful message
        if (rpcError.message.includes('function') && rpcError.message.includes('does not exist')) {
          console.warn("get_approved_subjects function not available - migration may not be run yet");
          setError("Subject management feature requires database migration. Please contact administrator.");
          setSubjects([]);
          return;
        }
        throw rpcError;
      }

      let filteredSubjects = data || [];
      
      // Filter by grade level if specified
      if (filterByGradeLevel) {
        filteredSubjects = filteredSubjects.filter(s => s.grade_level === filterByGradeLevel);
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
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        Select Subject
      </label>
      <select
        value={selectedSubjectId || ""}
        onChange={(e) => handleSubjectSelect(e.target.value || null)}
        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold text-sm"
      >
        <option value="">-- Select a Subject --</option>
        
        {subjects.length === 0 && (
          <option value="" disabled>
            No approved subjects available
          </option>
        )}
        
        {subjects.map((subject) => (
          <option key={subject.id} value={subject.id}>
            {subject.name}
            {subject.code && ` (${subject.code})`}
            {` - ${getGradeLabel(subject.grade_level)}`}
            {subject.is_assigned && " ✓"}
          </option>
        ))}
        
        {showRequestOption && (
          <option value="request_new" className="font-semibold text-brand-gold-dark">
            + Request New Subject
          </option>
        )}
      </select>

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