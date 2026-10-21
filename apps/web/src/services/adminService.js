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

/**
 * Whether a Senior Faculty can forward or return this submission. Mirrors
 * countReviewsNeedingAction.
 */
export const canSeniorFacultyReview = (submission, userId) =>
  submission?.status === "pending" &&
  submission.instructor_id !== userId &&
  (!submission.assigned_reviewer_id || submission.assigned_reviewer_id === userId);

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
   * Toggle an instructor account without deleting related data.
   */
  toggleInstructorStatus: async (userId, disabled) => {
    return await callEdgeFunction("toggle-instructor-status", {
      userId,
      disabled,
    });
  },

  /**
   * Pending submissions this Senior Faculty can act on: not their own, and
   * either unassigned or assigned to them (peer-assigned ones belong to the peer)
   */
  countReviewsNeedingAction: async (userId) => {
    return await supabase
      .from("quiz_analysis_submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .neq("instructor_id", userId)
      .or(`assigned_reviewer_id.is.null,assigned_reviewer_id.eq.${userId}`);
  },

  /**
   * Everything the instructor detail page shows, in one round of queries.
   * Returns { profile: null } when the id isn't an instructor account.
   */
  getInstructorOverview: async (instructorId) => {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(
        "id, username, first_name, last_name, email, avatar_url, bio, created_at, is_disabled, is_approved, is_instructor, is_admin, is_faculty_head",
      )
      .eq("id", instructorId)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile || !profile.is_instructor || profile.is_admin || profile.is_faculty_head) {
      return { profile: null };
    }

    const submissionFields =
      "id, quiz_id, instructor_id, status, created_at, reviewed_at, reviewed_by, assigned_reviewer_id, admin_feedback, faculty_head_feedback, faculty_head_reviewed_by, summary:analysis_results->summary, quizzes(title, version_number, parent_quiz_id)";

    const [sectionsRes, quizzesRes, attemptsRes, submissionsRes, reviewsRes, activityRes] =
      await Promise.all([
        supabase
          .from("sections")
          .select("id, name, is_archived, subject_id, subjects(id, name, code)")
          .eq("instructor_id", instructorId)
          .order("created_at", { ascending: true }),
        supabase
          .from("quizzes")
          .select("id, title, is_published, is_archived, created_at, section_id, parent_quiz_id, version_number")
          .eq("instructor_id", instructorId)
          .order("created_at", { ascending: false }),
        supabase.rpc("get_instructor_attempt_counts", { p_instructor_id: instructorId }),
        supabase
          .from("quiz_analysis_submissions")
          .select(submissionFields)
          .eq("instructor_id", instructorId)
          .order("created_at", { ascending: false }),
        supabase
          .from("quiz_analysis_submissions")
          .select(submissionFields)
          .eq("assigned_reviewer_id", instructorId)
          .order("created_at", { ascending: false }),
        supabase
          .from("audit_trail")
          .select("id, action, table_name, item_name, previous_status, new_status, created_at")
          .eq("user_id", instructorId)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

    const firstError = [sectionsRes, quizzesRes, submissionsRes, reviewsRes, activityRes].find(
      (r) => r.error,
    )?.error;
    if (firstError) throw firstError;

    // Names for reviewers / submitters referenced by the two submission lists
    const submissions = submissionsRes.data || [];
    const reviews = reviewsRes.data || [];
    const peopleIds = [
      ...new Set(
        [
          ...submissions.flatMap((s) => [s.assigned_reviewer_id, s.reviewed_by]),
          ...reviews.map((r) => r.instructor_id),
        ].filter(Boolean),
      ),
    ];
    const { data: people } = peopleIds.length
      ? await supabase
          .from("profiles")
          .select("id, first_name, last_name, username, email")
          .in("id", peopleIds)
      : { data: [] };

    return {
      profile,
      sections: sectionsRes.data || [],
      quizzes: quizzesRes.data || [],
      // The RPC arrives with 20261024_instructor_attempt_counts.sql
      attemptCounts: attemptsRes.error ? null : attemptsRes.data || [],
      submissions,
      reviews,
      activity: activityRes.data || [],
      people: people || [],
    };
  },

  /**
   * Fetch all pending registration requests (is_approved = false, is_admin = false)
   */
  getRegistrationRequests: async () => {
    return await supabase
      .from("profiles")
      .select("id, username, first_name, last_name, email, created_at")
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
      .update({ is_approved: true, is_instructor: true })
      .eq("id", userId);
  },

  /**
   * Reject a registration request (deletes the auth user)
   */
  rejectRegistration: async (userId) => {
    return await callEdgeFunction("delete-instructor", { userId });
  },

  /**
   * Change an instructor's password via edge function.
   */
  changeInstructorPassword: async (userId, newPassword) => {
    return await callEdgeFunction("change-instructor-password", {
      userId,
      newPassword,
    });
  },
};
