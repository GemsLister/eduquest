import { supabase } from "../supabaseClient.js";
import { logAudit } from "./auditService.js";

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
      .select("*, subjects(id, name, code, description)")
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
    const result = await supabase.from("sections").insert([sectionData]).select();
    
    // Log to audit trail and create teaching assignment if successful
    if (result.data && result.data[0]) {
      const createdSection = result.data[0];

      // Create teaching_assignments record
      if (createdSection.instructor_id && createdSection.subject_id) {
        try {
          await supabase.from("teaching_assignments").insert([
            {
              instructor_id: createdSection.instructor_id,
              subject_id: createdSection.subject_id,
              section_id: createdSection.id,
            },
          ]);
        } catch (taErr) {
          console.warn("Could not insert teaching assignment:", taErr);
        }
      }

      await logAudit({
        action: "SECTION_CREATED",
        tableName: "sections",
        recordId: createdSection.id,
        newValues: { name: sectionData.name, description: sectionData.description },
        userRole: "instructor"
      });
    }
    
    return result;
  },

  /**
   * Update a section
   * @param {string} sectionId - Section ID
   * @param {object} updates - Fields to update
   * @returns {Promise<{data, error}>}
   */
  updateSection: async (sectionId, updates) => {
    // Get old values for audit log
    const { data: oldData } = await supabase
      .from("sections")
      .select("*")
      .eq("id", sectionId)
      .single();
    
    const result = await supabase
      .from("sections")
      .update(updates)
      .eq("id", sectionId)
      .select();
    
    // Log to audit trail if successful
    if (result.data && !result.error) {
      await logAudit({
        action: "SECTION_UPDATED",
        tableName: "sections",
        recordId: sectionId,
        oldValues: { name: oldData?.name, description: oldData?.description },
        newValues: updates,
        userRole: "instructor"
      });
    }
    
    return result;
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
    // Get section info for audit log
    const { data: sectionData } = await supabase
      .from("sections")
      .select("name, description")
      .eq("id", sectionId)
      .single();
    
    const result = await supabase
      .from("sections")
      .update({ is_archived: true })
      .eq("id", sectionId)
      .select();
    
    // Log to audit trail if successful
    if (result.data && !result.error) {
      await logAudit({
        action: "SECTION_ARCHIVED",
        tableName: "sections",
        recordId: sectionId,
        newValues: { name: sectionData?.name, description: sectionData?.description },
        userRole: "instructor"
      });
    }
    
    return result;
  },
};
