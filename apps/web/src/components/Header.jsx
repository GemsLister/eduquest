import { useUsername } from "../hooks/useUsername";
import defaultAvatar from "../assets/instructor-profile.png";
import { Link, useLocation } from "react-router-dom";
import { NotificationBell } from "./NotificationBell";

const pageTitles = {
  "/instructor-dashboard/section": "Subjects",
  "/instructor-dashboard/subject": "Subjects",
  "/instructor-dashboard/quizzes": "Quizzes",
  "/instructor-dashboard/instructor-quiz": "Quizzes",
  "/instructor-dashboard/quiz-results": "Quiz Results",
  "/instructor-dashboard/question-bank": "Question Bank",
  "/instructor-dashboard/instructor-questions": "Questions",
  "/instructor-dashboard/item-difficulty-analysis": "Item Analysis",
  "/instructor-dashboard/quiz-versions": "Quiz Versions",
  "/instructor-dashboard/saved-analysis": "Saved Analysis",
  "/instructor-dashboard/peer-reviews": "Peer Reviews",
  "/instructor-dashboard/student-profiles": "Student Profiles",
  "/instructor-dashboard/my-submissions": "My Submissions",
  "/instructor-dashboard/history": "History",
  "/instructor-dashboard/instructor-profile": "Profile",
  "/instructor-dashboard": "Subjects",
  "/admin-dashboard/subjects": "Subjects",
  "/admin-dashboard/section": "Subjects",
  "/admin-dashboard/subject": "Subjects",
  "/admin-dashboard/quizzes": "Quizzes",
  "/admin-dashboard/create-quiz": "Create Quiz",
  "/admin-dashboard/my-submissions": "My Submissions",
  "/admin-dashboard/quiz-reviews": "Exam Reviews",
  "/admin-dashboard/instructors": "Instructors",
  "/admin-dashboard/registration-requests": "Registration Requests",
  "/admin-dashboard/create-instructor": "Add Instructor",
  "/admin-dashboard/question-bank": "Question Bank",
  "/admin-dashboard/quiz-results": "Quiz Results",
  "/admin-dashboard": "Dashboard",
};

export const Header = () => {
  const userData = useUsername();
  const location = useLocation();

  const matched = Object.entries(pageTitles).find(([path]) => {
    if (path === "/instructor-dashboard" || path === "/admin-dashboard") {
      return location.pathname === path || location.pathname === `${path}/`;
    }
    return location.pathname.startsWith(path);
  });
  const pageTitle = matched ? matched[1] : "Subjects";
  

  if (userData.loading)
    return <div className="h-16 bg-white border-b border-gray-100" />;

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 bg-white border-b border-gray-100 shadow-sm">
      {/* Page title */}
      <h1 className="text-lg font-bold text-brand-navy tracking-tight">
        {pageTitle}
      </h1>

      {/* Right side */}
      <div className="flex items-center gap-3">
        <NotificationBell />
        <Link
          to="/instructor-dashboard/instructor-profile"
          className="flex items-center gap-3 group"
        >
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-gray-800 group-hover:text-brand-navy transition-colors">
              {userData.googleName || userData.dbName}
            </p>
            <p className="text-xs text-gray-400">Instructor</p>
          </div>
          <img
            src={userData.avatarUrl || defaultAvatar}
            alt="instructor-image"
            className="h-10 w-10 rounded-full object-cover aspect-square ring-2 ring-brand-gold/40 group-hover:ring-brand-gold transition-all"
          />
        </Link>
      </div>
    </header>
  );
};
