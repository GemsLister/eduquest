import { useUsername } from "../hooks/useUsername";
import defaultAvatar from "../assets/instructor-profile.png";
import { Link, useLocation } from "react-router-dom";
import { NotificationBell } from "./NotificationBell";

const pageTitles = {
  "/instructor-dashboard/section": "Section",
  "/instructor-dashboard/subject": "Subjects",
  "/instructor-dashboard/quizzes": "My Exams",
  "/instructor-dashboard/instructor-quiz": "Exam Editor",
  "/instructor-dashboard/quiz-results": "Exam Results",
  "/instructor-dashboard/question-bank": "Question Bank",
  "/instructor-dashboard/instructor-questions": "Questions",
  "/instructor-dashboard/item-difficulty-analysis": "Item Analysis",
  "/instructor-dashboard/peer-reviews": "Peer Review",
  "/instructor-dashboard/student-profiles": "Student Profiles",
  "/instructor-dashboard/my-submissions": "Submissions & Reviews",
  "/instructor-dashboard/history": "History",
  "/instructor-dashboard/instructor-profile": "Profile",
  "/instructor-dashboard": "Subjects",
  "/admin-dashboard/subjects": "Subjects",
  "/admin-dashboard/section": "Subjects",
  "/admin-dashboard/subject": "Subjects",
  "/admin-dashboard/quizzes": "My Exams",
  "/admin-dashboard/create-quiz": "Exam Editor",
  "/admin-dashboard/my-submissions": "My Submissions",
  "/admin-dashboard/quiz-reviews": "Exam Reviews",
  // Before "/admin-dashboard/instructors": the first prefix match wins
  "/admin-dashboard/instructors/": "Instructor Details",
  "/admin-dashboard/instructors": "Instructors",
  "/admin-dashboard/registration-requests": "Registration Requests",
  "/admin-dashboard/create-instructor": "Add Instructor",
  "/admin-dashboard/question-bank": "Question Bank",
  "/admin-dashboard/item-difficulty-analysis": "Item Analysis",
  "/admin-dashboard/student-profiles": "Student Profiles",
  "/admin-dashboard/quiz-results": "Exam Results",
  "/admin-dashboard/profile": "Profile",
  "/admin-dashboard/audit-trail": "Audit Trail",
  "/admin-dashboard": "Dashboard",
  "/faculty-head-dashboard/quiz-approvals": "Exam Approvals",
  "/faculty-head-dashboard/subject-requests": "Subject Requests",
  "/faculty-head-dashboard/audit-trail": "Audit Trail",
  "/faculty-head-dashboard/settings": "Settings",
  "/faculty-head-dashboard/profile": "Profile",
  "/faculty-head-dashboard": "Dashboard",
};

// Per-portal home path, profile link and role label
const portals = [
  {
    prefix: "/faculty-head-dashboard",
    profilePath: "/faculty-head-dashboard/profile",
    roleLabel: "Department Head",
    fallbackTitle: "Dashboard",
  },
  {
    prefix: "/admin-dashboard",
    profilePath: "/admin-dashboard/profile",
    roleLabel: "Senior Faculty",
    fallbackTitle: "Dashboard",
  },
  {
    prefix: "/instructor-dashboard",
    profilePath: "/instructor-dashboard/instructor-profile",
    roleLabel: "Instructor",
    fallbackTitle: "Subjects",
  },
];

export const Header = ({ onMenuClick, menuOpen = false }) => {
  const userData = useUsername();
  const location = useLocation();

  const portal =
    portals.find((p) => location.pathname.startsWith(p.prefix)) ||
    portals[portals.length - 1];

  const matched = Object.entries(pageTitles).find(([path]) => {
    if (portals.some((p) => p.prefix === path)) {
      return location.pathname === path || location.pathname === `${path}/`;
    }
    return location.pathname.startsWith(path);
  });
  const pageTitle = matched ? matched[1] : portal.fallbackTitle;

  if (userData.loading)
    return <div className="h-16 bg-white border-b border-gray-100" />;

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-white border-b border-gray-100 shadow-sm">
      <div className="flex items-center gap-2 min-w-0">
        {/* Opens the sidebar drawer on small screens */}
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open navigation menu"
            aria-expanded={menuOpen}
            className="md:hidden -ml-1 p-2 rounded-lg text-brand-navy hover:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}
        {/* Page title (each page renders its own h1 in the hero banner) */}
        <p className="text-lg font-bold text-brand-navy tracking-tight truncate">
          {pageTitle}
        </p>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        <NotificationBell />
        <Link
          to={portal.profilePath}
          className="flex items-center gap-3 group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
        >
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-gray-800 group-hover:text-brand-navy transition-colors">
              {userData.googleName || userData.dbName}
            </p>
            <p className="text-xs text-gray-400">{portal.roleLabel}</p>
          </div>
          <img
            src={userData.avatarUrl || defaultAvatar}
            alt={`${portal.roleLabel} profile picture`}
            className="h-10 w-10 rounded-full object-cover aspect-square ring-2 ring-brand-gold/40 group-hover:ring-brand-gold transition-all"
          />
        </Link>
      </div>
    </header>
  );
};
