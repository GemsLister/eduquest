import { useState, useEffect } from "react";
import { subjectService } from "../../services/subjectService.js";
import { loadHeadSubmissions, HEAD_STATUSES } from "../../services/facultyHeadService.js";
import { GroupedSidebar, NavIcon } from "../container/GroupedSidebar.jsx";

const sections = [
  {
    name: "Dashboard",
    path: "/faculty-head-dashboard",
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
    name: "Approvals",
    icon: (
      <NavIcon>
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
        <path d="M9 14l2 2 4-4" />
      </NavIcon>
    ),
    children: [
      { name: "Quiz Approvals", path: "/faculty-head-dashboard/quiz-approvals", badge: "quizzes" },
      { name: "Subject Requests", path: "/faculty-head-dashboard/subject-requests", badge: "subjects" },
    ],
  },
  {
    name: "Audit Trail",
    path: "/faculty-head-dashboard/audit-trail",
    icon: (
      <NavIcon>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </NavIcon>
    ),
  },
  {
    name: "Settings",
    path: "/faculty-head-dashboard/settings",
    icon: (
      <NavIcon>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </NavIcon>
    ),
  },
];

// mobileOpen/onNavigate come from PortalLayout (drawer on small screens)
export const FacultyHeadSidebar = ({ mobileOpen = false, onNavigate }) => {
  const [pendingQuizCount, setPendingQuizCount] = useState(0);
  const [pendingSubjectCount, setPendingSubjectCount] = useState(0);

  useEffect(() => {
    const fetchCounts = async () => {
      // Pending Quiz Approvals — same per-chain counting as the Quiz Approvals list
      try {
        const subs = await loadHeadSubmissions({ enrich: false });
        setPendingQuizCount(subs.filter((s) => s.status === HEAD_STATUSES.PENDING).length);
      } catch (err) {
        console.warn("Could not load pending approvals count:", err);
      }

      // Pending Subject Requests
      try {
        const { data: reqs } = await subjectService.getAllSubjectRequests();
        const pendingReqs = (reqs || []).filter(
          (r) => r.request_status === "pending"
        ).length;
        setPendingSubjectCount(pendingReqs);
      } catch (err) {
        console.warn("Could not load subject requests count:", err);
      }
    };

    fetchCounts();

    window.addEventListener("pending-quiz-approvals-changed", fetchCounts);
    window.addEventListener("subject-requests-changed", fetchCounts);
    window.addEventListener("pending-subject-requests-changed", fetchCounts);
    return () => {
      window.removeEventListener("pending-quiz-approvals-changed", fetchCounts);
      window.removeEventListener("subject-requests-changed", fetchCounts);
      window.removeEventListener("pending-subject-requests-changed", fetchCounts);
    };
  }, []);

  return (
    <GroupedSidebar
      sections={sections}
      badgeCounts={{ quizzes: pendingQuizCount, subjects: pendingSubjectCount }}
      ariaLabel="Department Head"
      profilePath="/faculty-head-dashboard/profile"
      storageKey="departmentHeadSidebarPinned"
      mobileOpen={mobileOpen}
      onNavigate={onNavigate}
    />
  );
};
