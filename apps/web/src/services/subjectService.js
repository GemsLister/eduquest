import { supabase } from "../supabaseClient.js";

/**
 * Subject Service
 * Handles subject and instructor-subject-section relationship operations
 */

export const subjectService = {
  // ============ SUBJECT OPERATIONS ============

  /**
   * Get all subjects (independent of instructor)
   * @returns {Promise<{data, error}>}
   */
  getAllSubjects: async () => {
    return await supabase
      .from("subjects")
      .select("*")
      .eq("is_archived", false)
      .order("name", { ascending: true });
  },

  /**
   * Get subjects assigned to current instructor
   * @returns {Promise<{data, error}>}
   */
  getInstructorSubjects: async () => {
    return await supabase.rpc("get_instructor_subjects_with_sections");
  },

  /**
   * Create a new subject
   * @param {object} subjectData - Subject data (name, code, description, grade_level)
   * @returns {Promise<{data, error}>}
   */
  createSubject: async (subjectData) => {
    return await supabase.from("subjects").insert([subjectData]).select();
  },

  /**
   * Update a subject
   * @param {string} subjectId - Subject ID
   * @param {object} updates - Fields to update
   * @returns {Promise<{data, error}>}
   */
  updateSubject: async (subjectId, updates) => {
    return await supabase
      .from("subjects")
      .update(updates)
      .eq("id", subjectId)
      .select();
  },

  /**
   * Archive a subject
   * @param {string} subjectId - Subject ID
   * @returns {Promise<{error}>}
   */
  archiveSubject: async (subjectId) => {
    return await supabase
      .from("subjects")
      .update({ is_archived: true })
      .eq("id", subjectId);
  },

  // ============ INSTRUCTOR-SUBJECT OPERATIONS ============

  /**
   * Assign a subject to the current instructor
   * @param {string} subjectId - Subject ID
   * @param {string} instructorId - Optional instructor ID (defaults to current user)
   * @returns {Promise<{data, error}>}
   */
  assignSubjectToInstructor: async (subjectId, instructorId = null) => {
    return await supabase.rpc("assign_subject_to_instructor", {
      p_subject_id: subjectId,
      p_instructor_id: instructorId,
    });
  },

  /**
   * Remove subject assignment from instructor
   * @param {string} instructorSubjectId - Instructor-subject junction ID
   * @returns {Promise<{error}>}
   */
  removeInstructorSubject: async (instructorSubjectId) => {
    return await supabase
      .from("instructor_subjects")
      .delete()
      .eq("id", instructorSubjectId);
  },

  /**
   * Get instructor-subject assignments for current instructor
   * @returns {Promise<{data, error}>}
   */
  getInstructorSubjectAssignments: async () => {
    return await supabase
      .from("instructor_subjects")
      .select("*, subjects(*)")
      .eq("instructor_id", (await supabase.auth.getUser()).data.user.id);
  },

  // ============ SECTION ASSIGNMENT OPERATIONS ============

  /**
   * Assign sections to an instructor-subject combination
   * @param {string} instructorSubjectId - Instructor-subject junction ID
   * @param {string[]} sectionIds - Array of section IDs to assign
   * @returns {Promise<{data, error}>}
   */
  assignSectionsToInstructorSubject: async (instructorSubjectId, sectionIds) => {
    return await supabase.rpc("assign_sections_to_instructor_subject", {
      p_instructor_subject_id: instructorSubjectId,
      p_section_ids: sectionIds,
    });
  },

  /**
   * Remove section assignment from instructor-subject
   * @param {string} instructorSubjectId - Instructor-subject junction ID
   * @param {string} sectionId - Section ID to remove
   * @returns {Promise<{data, error}>}
   */
  removeSectionFromInstructorSubject: async (instructorSubjectId, sectionId) => {
    return await supabase.rpc("remove_section_from_instructor_subject", {
      p_instructor_subject_id: instructorSubjectId,
      p_section_id: sectionId,
    });
  },

  /**
   * Get sections assigned to an instructor-subject combination
   * @param {string} instructorSubjectId - Instructor-subject junction ID
   * @returns {Promise<{data, error}>}
   */
  getSectionsForInstructorSubject: async (instructorSubjectId) => {
    return await supabase
      .from("instructor_subject_sections")
      .select("*, sections(*)")
      .eq("instructor_subject_id", instructorSubjectId);
  },

  /**
   * Get all sections for current instructor
   * @returns {Promise<{data, error}>}
   */
  getInstructorSections: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return await supabase
      .from("sections")
      .select("*")
      .eq("instructor_id", user.id)
      .eq("is_archived", false)
      .order("name", { ascending: true });
  },

  // ============ ADMIN/SENIOR FACULTY OPERATIONS ============

  /**
   * Get all instructors with their profiles
   * @returns {Promise<{data, error}>}
   */
  getAllInstructors: async () => {
    return await supabase
      .from("profiles")
      .select("id, first_name, last_name, email, username")
      .eq("is_instructor", true)
      .order("last_name", { ascending: true });
  },

  /**
   * Get all instructor-subject assignments
   * @returns {Promise<{data, error}>}
   */
  getAllInstructorSubjectAssignments: async () => {
    return await supabase
      .from("instructor_subjects")
      .select("*, subjects(*), profiles(first_name, last_name, email)")
      .order("assigned_at", { ascending: false });
  },

  /**
   * Get instructors assigned to a specific subject
   * @param {string} subjectId - Subject ID
   * @returns {Promise<{data, error}>}
   */
  getInstructorsForSubject: async (subjectId) => {
    return await supabase
      .from("instructor_subjects")
      .select("*, profiles(first_name, last_name, email)")
      .eq("subject_id", subjectId);
  },

  // ============ GRADE LEVEL OPERATIONS ============

  /**
   * Get subjects by grade level
   * @param {string} gradeLevel - Grade level (1st, 2nd, 3rd, 4th)
   * @returns {Promise<{data, error}>}
   */
  getSubjectsByGradeLevel: async (gradeLevel) => {
    return await supabase.rpc("get_subjects_by_grade_level", {
      p_grade_level: gradeLevel,
    });
  },

  /**
   * Get all grade levels with subject counts
   * @returns {Promise<{data, error}>}
   */
  getGradeLevelsWithCounts: async () => {
    return await supabase.rpc("get_grade_levels_with_counts");
  },

  /**
   * Join a subject (assign current instructor to subject)
   * @param {string} subjectId - Subject ID
   * @returns {Promise<{data, error}>}
   */
  joinSubject: async (subjectId) => {
    return await supabase.rpc("join_subject", { p_subject_id: subjectId });
  },

  /**
   * Leave a subject (remove current instructor from subject)
   * @param {string} subjectId - Subject ID
   * @returns {Promise<{data, error}>}
   */
  leaveSubject: async (subjectId) => {
    return await supabase.rpc("leave_subject", { p_subject_id: subjectId });
  },
};
