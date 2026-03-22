import { useUsername } from "../hooks/useUsername";
import defaultAvatar from "../assets/instructor-profile.png";
import { Link, useLocation } from "react-router-dom";
import { NotificationBell } from "./NotificationBell";

const pageTitles = {
  "/instructor-dashboard": "Sections",
  "/instructor-dashboard/instructor-questions": "Questions",
  "/instructor-dashboard/item-difficulty-analysis": "Item Analysis",
  "/instructor-dashboard/instructor-profile": "My Profile",
};

export const Header = () => {
  const userData = useUsername();
  const location = useLocation();

  const pageTitle =
    Object.entries(pageTitles).find(
      ([path]) =>
        location.pathname.startsWith(path) &&
        (path === "/instructor-dashboard" ? location.pathname === path : true),
    )?.[1] ?? "Dashboard";

  if (userData.loading)
    return <div className="h-16 bg-white border-b border-gray-100" />;

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 bg-white border-b border-gray-100 shadow-sm">
      {/* Page title */}
      <h1 className="text-lg font-bold text-hornblende-green tracking-tight">
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
            <p className="text-sm font-semibold text-gray-800 group-hover:text-hornblende-green transition-colors">
              {userData.googleName || userData.dbName}
            </p>
            <p className="text-xs text-gray-400">Instructor</p>
          </div>
          <img
            src={userData.avatarUrl || defaultAvatar}
            alt="instructor-image"
            className="h-10 w-10 rounded-full object-cover aspect-square ring-2 ring-casual-green/40 group-hover:ring-casual-green transition-all"
          />
        </Link>
      </div>
    </header>
  );
};
