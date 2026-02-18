import { supabase } from "../supabaseClient.js";

/**
 * Quiz Service
 * Handles all quiz-related database operations
 */

export const quizService = {
  // ============ QUIZ OPERATIONS ============

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
      .order("created_at", { ascending: false });
  },

  /**
   * Create a new quiz
   * @param {object} quizData - Quiz data
   * @returns {Promise<{data, error}>}
   */
  createQuiz: async (quizData) => {
    return await supabase.from("quizzes").insert([quizData]).select();
  },

  /**
   * Update a quiz
   * @param {string} quizId - Quiz ID
   * @param {object} updates - Fields to update
   * @returns {Promise<{data, error}>}
   */
  updateQuiz: async (quizId, updates) => {
    return await supabase
      .from("quizzes")
      .update(updates)
      .eq("id", quizId)
      .select();
  },

  /**
   * Delete a quiz
   * @param {string} quizId - Quiz ID
   * @returns {Promise<{error}>}
   */
  deleteQuiz: async (quizId) => {
    return await supabase.from("quizzes").delete().eq("id", quizId);
  },

  // ============ QUESTION OPERATIONS ============

  /**
   * Get questions by quiz ID
   * @param {string} quizId - Quiz ID
   * @returns {Promise<{data, error}>}
   */
  getQuestionsByQuiz: async (quizId) => {
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
    return await supabase.from("questions").insert(questions);
  },

  /**
   * Delete a question
   * @param {string} questionId - Question ID
   * @returns {Promise<{error}>}
   */
  deleteQuestion: async (questionId) => {
    return await supabase.from("questions").delete().eq("id", questionId);
  },

  /**
   * Update a question
   * @param {string} questionId - Question ID
   * @param {object} updates - Fields to update
   * @returns {Promise<{data, error}>}
   */
  updateQuestion: async (questionId, updates) => {
    return await supabase
      .from("questions")
      .update(updates)
      .eq("id", questionId)
      .select();
  },

  /**
   * Delete all questions for a quiz
   * @param {string} quizId - Quiz ID
   * @returns {Promise<{error}>}
   */
  deleteQuestionsByQuiz: async (quizId) => {
    return await supabase.from("questions").delete().eq("quiz_id", quizId);
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
};
