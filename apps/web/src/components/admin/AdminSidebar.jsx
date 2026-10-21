import { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { adminService } from "../../services/adminService.js";
import { GroupedSidebar, NavIcon } from "../container/GroupedSidebar.jsx";
import { useUnseenCount } from "../../hooks/useUnseenBadge.js";

const sections = [
  {
    name: "Dashboard",
    path: "/admin-dashboard",
    exact: true,
    icon: (
      <NavIcon>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </NavIcon>
    ),
  },
  {
    name: "Teaching",
    icon: (
      <NavIcon>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </NavIcon>
    ),
    children: [
      { name: "Subjects", path: "/admin-dashboard/subjects", match: ["/admin-dashboard/section"] },
      {
        name: "My Quizzes",
        path: "/admin-dashboard/quizzes",
        match: ["/admin-dashboard/create-quiz", "/admin-dashboard/quiz-results"],
      },
      { name: "Question Bank", path: "/admin-dashboard/question-bank" },
      { name: "Item Analysis", path: "/admin-dashboard/item-difficulty-analysis" },
      { name: "Student Profiles", path: "/admin-dashboard/student-profiles" },
    ],
  },
  {
    name: "Reviews",
    icon: (
      <NavIcon>
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
        <path d="M9 14l2 2 4-4" />
      </NavIcon>
    ),
    children: [
      { name: "Exam Reviews", path: "/admin-dashboard/quiz-reviews", badge: "reviews" },
      { name: "My Submissions", path: "/admin-dashboard/my-submissions", badge: "submissions" },
    ],
  },
  {
    name: "Accounts",
    icon: (
      <NavIcon>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </NavIcon>
    ),
    children: [
      { name: "Instructors", path: "/admin-dashboard/instructors" },
      { name: "Registrations", path: "/admin-dashboard/registration-requests", badge: "registrations" },
      { name: "Add Instructor", path: "/admin-dashboard/create-instructor" },
    ],
  },
  {
    name: "Audit Trail",
    path: "/admin-dashboard/audit-trail",
    icon: (
      <NavIcon>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </NavIcon>
    ),
  },
];

// mobileOpen/onNavigate come from PortalLayout (drawer on small screens)
export const AdminSidebar = ({ mobileOpen = false, onNavigate }) => {
  const { user } = useAuth();
  // Item keys behind each badge; a badge clears once its page is viewed
  const [registrationKeys, setRegistrationKeys] = useState([]);
  const [reviewKeys, setReviewKeys] = useState([]);
  const [submissionKeys, setSubmissionKeys] = useState([]);

  const pendingCount = useUnseenCount(user?.id, "registrations", registrationKeys, [
    "/admin-dashboard/registration-requests",
  ]);
  const pendingQuizCount = useUnseenCount(user?.id, "reviews", reviewKeys, [
    "/admin-dashboard/quiz-reviews",
  ]);
  const mySubmissionsNotifCount = useUnseenCount(user?.id, "submissions", submissionKeys, [
    "/admin-dashboard/my-submissions",
  ]);

  useEffect(() => {
    const fetchPendingCount = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("is_approved", false)
        .eq("is_admin", false);
      setRegistrationKeys((data || []).map((p) => `reg:${p.id}`));
    };

    fetchPendingCount();

    // Re-fetch when approve/reject actions happen
    window.addEventListener("pending-requests-changed", fetchPendingCount);
    return () =>
      window.removeEventListener("pending-requests-changed", fetchPendingCount);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    // Only submissions this Senior Faculty can act on, not peer-assigned ones
    const fetchPendingQuizCount = async () => {
      const { data } = await adminService.listReviewsNeedingAction(user.id);
      setReviewKeys((data || []).map((s) => `review:${s.id}:pending`));
    };

    fetchPendingQuizCount();

    window.addEventListener("pending-quiz-reviews-changed", fetchPendingQuizCount);
    return () =>
      window.removeEventListener("pending-quiz-reviews-changed", fetchPendingQuizCount);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const fetchMySubmissionsNotifs = async () => {
      try {
        // Revision requests not yet resubmitted (a resubmission points back
        // via previous_submission_id), same as the instructor sidebar
        const { data: ownSubs } = await supabase
          .from("quiz_analysis_submissions")
          .select("id, status, previous_submission_id")
          .eq("instructor_id", user.id);
        const resubmittedIds = new Set(
          (ownSubs || []).map((s) => s.previous_submission_id).filter(Boolean),
        );
        setSubmissionKeys(
          (ownSubs || [])
            .filter((s) => s.status === "revision_requested" && !resubmittedIds.has(s.id))
            .map((s) => `rev:${s.id}:revision_requested`),
        );
      } catch (err) {
        console.warn("Could not fetch my submissions notifs:", err);
      }
    };

    fetchMySubmissionsNotifs();
    window.addEventListener("submissions-changed", fetchMySubmissionsNotifs);
    window.addEventListener("quiz-submissions-updated", fetchMySubmissionsNotifs);
    return () => {
      window.removeEventListener("submissions-changed", fetchMySubmissionsNotifs);
      window.removeEventListener("quiz-submissions-updated", fetchMySubmissionsNotifs);
    };
  }, [user?.id]);

  return (
    <GroupedSidebar
      sections={sections}
      badgeCounts={{
        registrations: pendingCount,
        reviews: pendingQuizCount,
        submissions: mySubmissionsNotifCount,
      }}
      ariaLabel="Senior Faculty"
      profilePath="/admin-dashboard/profile"
      storageKey="seniorFacultySidebarPinned"
      mobileOpen={mobileOpen}
      onNavigate={onNavigate}
    />
  );
};
