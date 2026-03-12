import { supabase } from "../supabaseClient.js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

// Use refreshSession to guarantee a fresh valid access token
const callEdgeFunction = async (functionName, body) => {
  const { data: refreshData } = await supabase.auth.refreshSession();
  const token = refreshData?.session?.access_token;

  if (!token) {
    return { data: null, error: "No active session. Please log in again." };
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok)
    return { data: null, error: data?.error || "Request failed" };
  return { data, error: null };
};

export const adminService = {
  /**
   * Fetch all instructor profiles
   */
  getInstructors: async () => {
    return await supabase.rpc("get_instructor_profiles");
  },

  /**
   * Create a new instructor account via edge function.
   * Uses service role on the server — safe for frontend to call.
   */
  createInstructor: async ({
    email,
    password,
    firstName,
    lastName,
    username,
  }) => {
    return await callEdgeFunction("create-instructor", {
      email,
      password,
      firstName,
      lastName,
      username,
    });
  },

  /**
   * Delete an instructor account (auth + profile) via edge function.
   */
  deleteInstructor: async (userId) => {
    return await callEdgeFunction("delete-instructor", { userId });
  },

  /**
   * Fetch all pending registration requests (is_approved = false, is_admin = false)
   */
  getRegistrationRequests: async () => {
    return await supabase
      .from("profiles")
      .select("id, username, email, created_at")
      .eq("is_approved", false)
      .eq("is_admin", false)
      .order("created_at", { ascending: false });
  },

  /**
   * Approve a registration request
   */
  approveRegistration: async (userId) => {
    return await supabase
      .from("profiles")
      .update({ is_approved: true })
      .eq("id", userId);
  },

  /**
   * Reject a registration request (deletes the auth user)
   */
  rejectRegistration: async (userId) => {
    return await callEdgeFunction("delete-instructor", { userId });
  },
};
