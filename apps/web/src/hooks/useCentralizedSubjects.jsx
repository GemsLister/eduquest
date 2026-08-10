import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

export const useCentralizedSubjects = () => {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchSubjects = async () => {
    try {
      setLoading(true);
      setError("");

      const { data, error: rpcError } = await supabase.rpc("get_approved_subjects");

      if (rpcError) throw rpcError;

      setSubjects(data || []);
    } catch (err) {
      console.error("Error fetching subjects:", err);
      setError("Failed to load subjects");
    } finally {
      setLoading(false);
    }
  };

  const assignInstructorToSubject = async (subjectId) => {
    try {
      const { error } = await supabase.rpc("join_subject", {
        p_subject_id: subjectId,
      });

      if (error) throw error;

      // Update local state
      setSubjects(prev => 
        prev.map(s => 
          s.id === subjectId ? { ...s, is_assigned: true } : s
        )
      );

      return { success: true };
    } catch (err) {
      console.error("Error assigning subject:", err);
      return { success: false, error: err.message };
    }
  };

  const removeInstructorFromSubject = async (subjectId) => {
    try {
      const { error } = await supabase.rpc("leave_subject", {
        p_subject_id: subjectId,
      });

      if (error) throw error;

      // Update local state
      setSubjects(prev => 
        prev.map(s => 
          s.id === subjectId ? { ...s, is_assigned: false } : s
        )
      );

      return { success: true };
    } catch (err) {
      console.error("Error removing subject assignment:", err);
      return { success: false, error: err.message };
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  return {
    subjects,
    loading,
    error,
    fetchSubjects,
    assignInstructorToSubject,
    removeInstructorFromSubject,
  };
};