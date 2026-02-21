import { supabase } from "../supabaseClient.js";

/**
 * Student Service
 * Handles all student-related database operations
 */

export const studentService = {
  /**
   * Get student profile by email
   * @param {string} email - Student email
   * @returns {Promise<{data, error}>}
   */
  getStudentByEmail: async (email) => {
    return await supabase
      .from("student_profile")
      .select("id")
      .eq("student_email", email)
      .maybeSingle();
  },

  /**
   * Get student profile by ID
   * @param {string} studentId - Student ID
   * @returns {Promise<{data, error}>}
   */
  getStudentById: async (studentId) => {
    return await supabase
      .from("student_profile")
      .select("*")
      .eq("id", studentId)
      .single();
  },

  /**
   * Create a new student profile
   * @param {object} studentData - Student data
   * @returns {Promise<{data, error}>}
   */
  createStudent: async (studentData) => {
    return await supabase
      .from("student_profile")
      .insert([studentData])
      .select()
      .single();
  },

  /**
   * Update student profile
   * @param {string} studentId - Student ID
   * @param {object} updates - Fields to update
   * @returns {Promise<{data, error}>}
   */
  updateStudent: async (studentId, updates) => {
    return await supabase
      .from("student_profile")
      .update(updates)
      .eq("id", studentId)
      .select();
  },

  /**
   * Delete student profile
   * @param {string} studentId - Student ID
   * @returns {Promise<{error}>}
   */
  deleteStudent: async (studentId) => {
    return await supabase
      .from("student_profile")
      .delete()
      .eq("id", studentId);
  },
};
