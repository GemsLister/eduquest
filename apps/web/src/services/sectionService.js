import { supabase } from "../supabaseClient.js";

/**
 * Section Service
 * Handles all section-related database operations
 */

export const sectionService = {
  /**
   * Get all sections for an instructor
   * @param {string} instructorId - Instructor ID
   * @returns {Promise<{data, error}>}
   */
  getSectionsByInstructor: async (instructorId) => {
    const { data, error } = await supabase
      .from("sections")
      .select("*")
      .eq("instructor_id", instructorId)
      .eq("is_archived", false)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get section by ID
   * @param {string} sectionId - Section ID
   * @returns {Promise<{data, error}>}
   */
  getSectionById: async (sectionId) => {
    return await supabase
      .from("sections")
      .select("*")
      .eq("id", sectionId)
      .single();
  },

  /**
   * Create a new section
   * @param {object} sectionData - Section data
   * @returns {Promise<{data, error}>}
   */
  createSection: async (sectionData) => {
    return await supabase.from("sections").insert([sectionData]).select();
  },

  /**
   * Update a section
   * @param {string} sectionId - Section ID
   * @param {object} updates - Fields to update
   * @returns {Promise<{data, error}>}
   */
  updateSection: async (sectionId, updates) => {
    return await supabase
      .from("sections")
      .update(updates)
      .eq("id", sectionId)
      .select();
  },

  /**
   * Delete a section
   * @param {string} sectionId - Section ID
   * @returns {Promise<{error}>}
   */
  deleteSection: async (sectionId) => {
    return await supabase.from("sections").delete().eq("id", sectionId);
  },

  /**
   * Archive a section
   * @param {string} sectionId - Section ID
   * @returns {Promise<{data, error}>}
   */
  archiveSection: async (sectionId) => {
    return await supabase
      .from("sections")
      .update({ is_archived: true })
      .eq("id", sectionId)
      .select();
  },
};
