import { supabase } from "../supabaseClient.js";

/**
 * Authentication Service
 * Handles all authentication-related database operations
 */

export const authService = {
  /**
   * Sign in with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<{data, error}>}
   */
  signInWithPassword: async (email, password) => {
    return await supabase.auth.signInWithPassword({ email, password });
  },

  /**
   * Sign up with email and password
   * @param {object} userData - User data containing email and password
   * @returns {Promise<{data, error}>}
   */
  signUp: async (userData) => {
    return await supabase.auth.signUp({
      email: userData.email.trim(),
    });
  },

  /**
   * Sign out the current user
   * @returns {Promise<{error}>}
   */
  signOut: async () => {
    return await supabase.auth.signOut();
  },

  /**
   * Get the current authenticated user
   * @returns {Promise<{data, error}>}
   */
  getUser: async () => {
    return await supabase.auth.getUser();
  },

  /**
   * Sign in with OAuth provider (e.g., Google)
   * @param {string} provider - OAuth provider name
   * @returns {Promise<{data, error}>}
   */
  signInWithOAuth: async (provider) => {
    return await supabase.auth.signInWithOAuth({ provider });
  },

  /**
   * Send password reset email
   * @param {string} email - User email
   * @returns {Promise<{data, error}>}
   */
  resetPasswordForEmail: async (email) => {
    return await supabase.auth.resetPasswordForEmail(email);
  },

  /**
   * Update user password
   * @param {string} password - New password
   * @returns {Promise<{data, error}>}
   */
  updateUser: async (password) => {
    return await supabase.auth.updateUser({ password });
  },
};
