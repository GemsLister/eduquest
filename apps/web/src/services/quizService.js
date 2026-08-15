import { supabase } from "../supabaseClient.js";
import { logAudit } from "./auditService.js";

const isMissingTableError = (error) => {
  if (!error) return false;
  const msg = (error.message || "").toLowerCase();
  const code = error.code || "";
  // PostgreSQL error code for undefined table
  return (
    code === "42P01" ||
    msg.includes("could not find the table") ||
    msg.includes("does not exist") ||
    msg.includes("relation") && msg.includes("does not exist")
  );
};

/**
 * Quiz Service
 * Handles all quiz-related database operations
 */

export const quizService = {
  // ============ QUIZ OPERATIONS ============

  /**
   * Log quiz status change
   * @param {string} quizId - Quiz ID
   * @param {string} newStatus - New status
   * @param {string} reason - Optional reason for status change
   * @returns {Promise<{data, error}>}
   */
  logStatusChange: async (quizId, newStatus, reason = null) => {
    return await supabase.rpc("log_quiz_status_change", {
      p_quiz_id: quizId,
      p_new_status: newStatus,
      p_reason: reason
    });
  },

  /**
   * Get quiz by ID
   * @param {string} quizId - Quiz ID
   * @returns {Promise<{data, error}>}
   */
  getQuizById: async (quizId) => {
    return await supabase.from("quizzes").select("*").eq("id", quizId).single();
  },

  /**
   * Get quiz by share token
   * @param {string} shareToken - Share token
   * @returns {Promise<{data, error}>}
   */
  getQuizByShareToken: async (shareToken) => {
    return await supabase
      .from("quizzes")
      .select("*")
      .eq("share_token", shareToken)
      .eq("is_published", true)
      .eq("is_archived", false)
      .single();
  },

  /**
   * Get all quizzes for an instructor
   * @param {string} instructorId - Instructor ID
   * @returns {Promise<{data, error}>}
   */
  getQuizzesByInstructor: async (instructorId) => {
    return await supabase
      .from("quizzes")
      .select("*, quiz_attempts(count)")
      .eq("instructor_id", instructorId)
      .eq("is_archived", false)
      .order("created_at", { ascending: false });
  },

  /**
   * Get quizzes by section
   * @param {string} sectionId - Section ID
   * @returns {Promise<{data, error}>}
   */
  getQuizzesBySection: async (sectionId) => {
    return await supabase
      .from("quizzes")
      .select("*, quiz_attempts(count)")
      .eq("section_id", sectionId)
      .eq("is_archived", false)
      .order("created_at", { ascending: false });
  },

  /**
   * Create a new quiz
   * @param {object} quizData - Quiz data
   * @returns {Promise<{data, error}>}
   */
  createQuiz: async (quizData) => {
    const result = await supabase.from("quizzes").insert([quizData]).select();
    
    // Log to audit trail if successful
    if (result.data && result.data[0]) {
      await supabase.rpc("log_quiz_audit", {
        p_action: "QUIZ_CREATED",
        p_quiz_id: result.data[0].id,
        p_details: { title: quizData.title, description: quizData.description }
      });
    }
    
    return result;
  },

  /**
   * Update a quiz
   * @param {string} quizId - Quiz ID
   * @param {object} updates - Fields to update
   * @returns {Promise<{data, error}>}
   */
  updateQuiz: async (quizId, updates) => {
    const result = await supabase
      .from("quizzes")
      .update(updates)
      .eq("id", quizId)
      .select();
    
    // Log to audit trail if successful
    if (result.data && !result.error) {
      await supabase.rpc("log_quiz_audit", {
        p_action: "QUIZ_UPDATED",
        p_quiz_id: quizId,
        p_details: { updated_fields: Object.keys(updates) }
      });
    }
    
    return result;
  },

  /**
   * Delete a quiz
   * @param {string} quizId - Quiz ID
   * @returns {Promise<{error}>}
   */
  deleteQuiz: async (quizId) => {
    // Get quiz info before deletion for audit log
    const { data: quizData } = await supabase
      .from("quizzes")
      .select("title, description")
      .eq("id", quizId)
      .single();
    
    const result = await supabase.from("quizzes").delete().eq("id", quizId);
    
    // Log to audit trail if successful
    if (!result.error) {
      await supabase.rpc("log_quiz_audit", {
        p_action: "QUIZ_DELETED",
        p_quiz_id: quizId,
        p_details: { title: quizData?.title, description: quizData?.description }
      });
    }
    
    return result;
  },

  // ============ QUESTION OPERATIONS ============

  /**
   * Get questions by quiz ID
   * Uses quiz_questions junction table with fallback to direct quiz_id
   * @param {string} quizId - Quiz ID
   * @returns {Promise<{data, error}>}
   */
  getQuestionsByQuiz: async (quizId) => {
    // Try junction table first
    try {
      const { data: viaJunction, error: junctionError } = await supabase
        .from("quiz_questions")
        .select("questions(*), order_index")
        .eq("quiz_id", quizId)
        .order("order_index", { ascending: true });

      if (!isMissingTableError(junctionError) && viaJunction && viaJunction.length > 0) {
        const questions = viaJunction
          .map((row) => row.questions)
          .filter((q) => q !== null);
        return { data: questions, error: null };
      }
    } catch (e) {
      // Ignore errors from junction table
    }

    // Fallback to direct quiz_id relationship for older quizzes
    return await supabase
      .from("questions")
      .select("*")
      .eq("quiz_id", quizId)
      .order("created_at", { ascending: true });
  },

  /**
   * Get question count for a quiz
   * @param {string} quizId - Quiz ID
   * @returns {Promise<{count, error}>}
   */
  getQuestionCount: async (quizId) => {
    // Try junction table count first
    try {
      const { count: junctionCount, error: junctionError } = await supabase
        .from("quiz_questions")
        .select("*", { count: "exact", head: true })
        .eq("quiz_id", quizId);

      if (!isMissingTableError(junctionError) && junctionCount && junctionCount > 0) {
        return { count: junctionCount, error: null };
      }
    } catch (e) {
      // Ignore
    }

    // Fallback to direct quiz_id count
    return await supabase
      .from("questions")
      .select("*", { count: "exact", head: true })
      .eq("quiz_id", quizId);
  },

  /**
   * Create questions
   * @param {Array} questions - Array of question objects
   * @returns {Promise<{error}>}
   */
  createQuestions: async (questions) => {
    const result = await supabase.from("questions").insert(questions).select();
    
    // Log to audit trail if successful
    if (result.data && result.data.length > 0) {
      await logAudit({
        action: "QUESTIONS_CREATED",
        tableName: "questions",
        recordId: result.data[0].id,
        newValues: { count: result.data.length, quiz_id: result.data[0].quiz_id },
        userRole: "instructor"
      });
    }
    
    return result;
  },

  /**
   * Delete a question
   * @param {string} questionId - Question ID
   * @returns {Promise<{error}>}
   */
  deleteQuestion: async (questionId) => {
    // Get question info before deletion for audit log
    const { data: questionData } = await supabase
      .from("questions")
      .select("question_text, quiz_id")
      .eq("id", questionId)
      .single();
    
    const result = await supabase.from("questions").delete().eq("id", questionId);
    
    // Log to audit trail if successful
    if (!result.error) {
      await logAudit({
        action: "QUESTION_DELETED",
        tableName: "questions",
        recordId: questionId,
        newValues: { question_text: questionData?.question_text, quiz_id: questionData?.quiz_id },
        userRole: "instructor"
      });
    }
    
    return result;
  },

  /**
   * Update a question
   * @param {string} questionId - Question ID
   * @param {object} updates - Fields to update
   * @returns {Promise<{data, error}>}
   */
  updateQuestion: async (questionId, updates) => {
    // Get old values for audit log
    const { data: oldData } = await supabase
      .from("questions")
      .select("question_text, options, correct_answer")
      .eq("id", questionId)
      .single();
    
    const result = await supabase
      .from("questions")
      .update(updates)
      .eq("id", questionId)
      .select();
    
    // Log to audit trail if successful
    if (result.data && !result.error) {
      await logAudit({
        action: "QUESTION_UPDATED",
        tableName: "questions",
        recordId: questionId,
        oldValues: { question_text: oldData?.question_text },
        newValues: { updated_fields: Object.keys(updates) },
        userRole: "instructor"
      });
    }
    
    return result;
  },

  /**
   * Delete all questions for a quiz
   * @param {string} quizId - Quiz ID
   * @returns {Promise<{error}>}
   */
  deleteQuestionsByQuiz: async (quizId) => {
    return await supabase.from("questions").delete().eq("quiz_id", quizId);
  },

  // ============ QUIZ SHARING OPERATIONS ============

  /**
   * Auto-share quiz with all sections in the same subject
   * Uses the database function auto_share_quiz_with_subject_sections
   * @param {string} quizId - Quiz ID
   * @returns {Promise<{data, error}>}
   */
  autoShareQuizWithSubjectSections: async (quizId) => {
    return await supabase.rpc("auto_share_quiz_with_subject_sections", {
      p_quiz_id: quizId
    });
  },

  /**
   * Get quiz by section-specific share token
   * @param {string} shareToken - Section-specific share token
   * @returns {Promise<{data, error}>}
   */
  getQuizBySectionShareToken: async (shareToken) => {
    return await supabase
      .from("quiz_sections")
      .select("*, quizzes(*), sections(*)")
      .eq("share_token", shareToken)
      .eq("quizzes.is_published", true)
      .single();
  },

  /**
   * Get all section-specific share tokens for a quiz
   * @param {string} quizId - Quiz ID
   * @returns {Promise<{data, error}>}
   */
  getQuizSectionShareTokens: async (quizId) => {
    return await supabase
      .from("quiz_sections")
      .select("share_token, sections(*), assigned_at")
      .eq("quiz_id", quizId);
  },

  /**
   * Generate share tokens for sections that don't have them
   * @param {string} quizId - Quiz ID
   * @returns {Promise<{data, error}>}
   */
  generateMissingSectionTokens: async (quizId) => {
    // Get sections without tokens
    const { data: sectionsWithoutTokens } = await supabase
      .from("quiz_sections")
      .select("id")
      .eq("quiz_id", quizId)
      .is("share_token", null);

    if (!sectionsWithoutTokens || sectionsWithoutTokens.length === 0) {
      return { data: [], error: null };
    }

    // Generate tokens for each section
    const tokenUpdates = sectionsWithoutTokens.map(section => ({
      id: section.id,
      share_token: null // Trigger auto-generation
    }));

    // Update each section (this will trigger the database function)
    for (const section of sectionsWithoutTokens) {
      await supabase
        .from("quiz_sections")
        .update({ share_token: null })
        .eq("id", section.id);
    }

    // Return the updated tokens
    return await this.getQuizSectionShareTokens(quizId);
  },

  // ============ QUIZ ATTEMPT OPERATIONS ============

  /**
   * Create a quiz attempt
   * @param {object} attemptData - Attempt data
   * @returns {Promise<{data, error}>}
   */
  createAttempt: async (attemptData) => {
    return await supabase
      .from("quiz_attempts")
      .insert([attemptData])
      .select()
      .single();
  },

  /**
   * Get attempts by quiz ID
   * @param {string} quizId - Quiz ID
   * @returns {Promise<{data, error}>}
   */
  getAttemptsByQuiz: async (quizId) => {
    return await supabase
      .from("quiz_attempts")
      .select("*")
      .eq("quiz_id", quizId);
  },

  /**
   * Get attempt by ID
   * @param {string} attemptId - Attempt ID
   * @returns {Promise<{data, error}>}
   */
  getAttemptById: async (attemptId) => {
    return await supabase
      .from("quiz_attempts")
      .select("*")
      .eq("id", attemptId)
      .single();
  },

  /**
   * Update attempt
   * @param {string} attemptId - Attempt ID
   * @param {object} updates - Fields to update
   * @returns {Promise<{data, error}>}
   */
  updateAttempt: async (attemptId, updates) => {
    return await supabase
      .from("quiz_attempts")
      .update(updates)
      .eq("id", attemptId)
      .select();
  },

  // ============ QUIZ RESPONSE OPERATIONS ============

  /**
   * Save a quiz response
   * @param {object} responseData - Response data
   * @returns {Promise<{error}>}
   */
  saveResponse: async (responseData) => {
    return await supabase.from("quiz_responses").insert([responseData]);
  },

  /**
   * Get responses by attempt ID
   * @param {string} attemptId - Attempt ID
   * @returns {Promise<{data, error}>}
   */
  getResponsesByAttempt: async (attemptId) => {
    return await supabase
      .from("quiz_responses")
      .select("points_earned")
      .eq("attempt_id", attemptId);
  },

  /**
   * Get responses with details by attempt ID
   * @param {string} attemptId - Attempt ID
   * @returns {Promise<{data, error}>}
   */
  getResponsesDetailsByAttempt: async (attemptId) => {
    return await supabase
      .from("quiz_responses")
      .select("*")
      .eq("attempt_id", attemptId);
  },

  /**
   * Upsert a single quiz response (auto-save)
   * Requires unique constraint on (attempt_id, question_id)
   * @param {object} responseData - Response data
   * @returns {Promise<{data, error}>}
   */
  upsertResponse: async (responseData) => {
    return await supabase
      .from("quiz_responses")
      .upsert(responseData, { onConflict: "attempt_id,question_id" });
  },

  /**
   * Delete all responses for an attempt (used before final submission re-insert)
   * @param {string} attemptId - Attempt ID
   * @returns {Promise<{error}>}
   */
  deleteResponsesByAttempt: async (attemptId) => {
    return await supabase
      .from("quiz_responses")
      .delete()
      .eq("attempt_id", attemptId);
  },

  // ============ CROSS-SECTION SHARING OPERATIONS ============

  /**
   * Share a quiz with other sections in the same subject
   * @param {string} quizId - Quiz ID
   * @param {string} subjectId - Subject ID
   * @returns {Promise<{data, error}>}
   */
  shareQuizWithSubjectSections: async (quizId, subjectId) => {
    return await supabase.rpc("share_quiz_with_subject_sections", {
      p_quiz_id: quizId,
      p_subject_id: subjectId,
    });
  },

  /**
   * Automatically share a quiz with all sections in the same subject
   * @param {string} quizId - Quiz ID
   * @returns {Promise<{data, error}>}
   */
  autoShareQuizWithSubjectSections: async (quizId) => {
    return await supabase.rpc("auto_share_quiz_with_subject_sections", {
      p_quiz_id: quizId,
    });
  },

  /**
   * Manually assign a quiz to specific sections
   * @param {string} quizId - Quiz ID
   * @param {string[]} sectionIds - Array of section IDs
   * @returns {Promise<{data, error}>}
   */
  assignQuizToSections: async (quizId, sectionIds) => {
    const sectionInserts = sectionIds.map((sectionId) => ({
      quiz_id: quizId,
      section_id: sectionId,
    }));

    return await supabase
      .from("quiz_sections")
      .insert(sectionInserts)
      .select();
  },

  /**
   * Remove a quiz from specific sections
   * @param {string} quizId - Quiz ID
   * @param {string[]} sectionIds - Array of section IDs to remove
   * @returns {Promise<{error}>}
   */
  removeQuizFromSections: async (quizId, sectionIds) => {
    return await supabase
      .from("quiz_sections")
      .delete()
      .eq("quiz_id", quizId)
      .in("section_id", sectionIds);
  },

  /**
   * Get all sections assigned to a quiz
   * @param {string} quizId - Quiz ID
   * @returns {Promise<{data, error}>}
   */
  getQuizSections: async (quizId) => {
    return await supabase
      .from("quiz_sections")
      .select("*, sections(*)")
      .eq("quiz_id", quizId);
  },
};
