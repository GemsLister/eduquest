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
      .select("*, subjects(id, name, code, description, is_archived)")
      .eq("instructor_id", instructorId)
      .eq("is_archived", false)
      .order("created_at", { ascending: false });

    if (error) throw error;
    // Sections under a subject the Department Head archived are retired with it
    return (data || []).filter((s) => !s.subjects?.is_archived);
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
        itemName: sectionData.name,
        newStatus: "active",
        sectionName: sectionData.name,
        newValues: { name: sectionData.name, description: sectionData.description },
        userRole: "instructor"
      });
    }
    
    return result;
  },

  /**
   * Create a section under a curriculum subject. Section names are stored as
   * "<Subject> - <Section code>" and the code is kept in `description`.
   * Retries with a new exam code if the random one is already taken.
   * @returns {Promise<{data, error}>} data is the created section
   */
  createSectionForSubject: async ({ instructorId, subjectId, subjectName, sectionCode }) => {
    const trimmedCode = (sectionCode || "").trim();
    if (!instructorId || !subjectId || !trimmedCode) {
      return { data: null, error: new Error("Subject and section name are required") };
    }

    const fullName = `${subjectName} - ${trimmedCode}`;

    const { data: existing } = await supabase
      .from("sections")
      .select("id")
      .eq("instructor_id", instructorId)
      .eq("subject_id", subjectId)
      .eq("name", fullName)
      .maybeSingle();
    if (existing) {
      return {
        data: null,
        error: new Error(`Section "${trimmedCode}" is already assigned to ${subjectName}.`),
      };
    }

    const makeExamCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

    let created = null;
    let lastError = null;
    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      const { data, error } = await supabase
        .from("sections")
        .insert([
          {
            instructor_id: instructorId,
            name: fullName,
            description: trimmedCode,
            subject_id: subjectId,
            exam_code: makeExamCode(),
          },
        ])
        .select("*, subjects(id, name, code, description)");

      if (!error) {
        created = data?.[0] || null;
      } else if (error.code === "23505" && String(error.message || "").includes("exam_code")) {
        lastError = error; // exam code collision, try another code
      } else {
        return { data: null, error };
      }
    }
    if (!created) {
      return { data: null, error: lastError || new Error("Failed to create section") };
    }

    try {
      await supabase.from("teaching_assignments").insert([
        { instructor_id: instructorId, subject_id: subjectId, section_id: created.id },
      ]);
    } catch (taErr) {
      console.warn("Could not insert teaching assignment:", taErr);
    }

    await logAudit({
      action: "SECTION_CREATED",
      tableName: "sections",
      recordId: created.id,
      itemName: created.name,
      newStatus: "active",
      sectionName: created.name,
      newValues: { name: created.name, description: created.description },
      userRole: "instructor",
    });

    return { data: created, error: null };
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
        itemName: updates.name || oldData?.name,
        sectionName: updates.name || oldData?.name,
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
        itemName: sectionData?.name,
        previousStatus: "active",
        newStatus: "archived",
        sectionName: sectionData?.name,
        newValues: { name: sectionData?.name, description: sectionData?.description },
        userRole: "instructor"
      });
    }
    
    return result;
  },
};
