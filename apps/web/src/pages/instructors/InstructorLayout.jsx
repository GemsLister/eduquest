import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import eduquestLogo from "../../assets/eduquest-logo.png";
import { ProfileIcon } from "../../assets/svg/ProfileIcon.jsx";
import { LogoutIcon } from "../../assets/svg/LogoutIcon.jsx";
import { useUsername } from "../../hooks/useUsername.jsx";
import InstructorImage from "../../assets/instructor-profile.png";

export const InstructorLayout = () => {
  const location = useLocation();
  const userData = useUsername();
  const [profileDropdown, setProfileDropdown] = useState(false);

  const isActive = (path) => location.pathname === path;

  return (
    <div className="flex flex-col h-screen bg-authentic-white">
      {/* Google Classroom-style Top Navigation */}
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-3 flex items-center justify-between">
          {/* Logo and Brand */}
          <div className="flex items-center gap-4">
            <img src={eduquestLogo} alt="EduQuest" className="h-10 w-10" />
            <span className="text-xl font-semibold text-gray-800">
              EduQuest
            </span>
          </div>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-8">
            <Link
              to="/instructor-dashboard"
              className={`font-medium transition-colors ${
                isActive("/instructor-dashboard")
                  ? "text-casual-green border-b-2 border-casual-green pb-3"
                  : "text-gray-700 hover:text-casual-green pb-3"
              }`}
            >
              Classes
            </Link>
            <Link
              to="/instructor-dashboard/instructor-profile"
              className={`font-medium transition-colors ${
                isActive("/instructor-dashboard/instructor-profile")
                  ? "text-casual-green border-b-2 border-casual-green pb-3"
                  : "text-gray-700 hover:text-casual-green pb-3"
              }`}
            >
              Profile
            </Link>
          </div>

          {/* Right Section - Profile Dropdown */}
          <div className="relative flex items-center gap-4">
            <button
              onClick={() => setProfileDropdown(!profileDropdown)}
              className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-100 transition-colors"
            >
              <img
                src={InstructorImage}
                alt="profile"
                className="h-8 w-8 rounded-full"
              />
              {userData.googleName || userData.dbName}
            </button>

            {/* Dropdown Menu */}
            {profileDropdown && (
              <div className="absolute right-0 mt-32 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <Link
                  to="/instructor-dashboard/instructor-profile"
                  className="flex items-center gap-2 px-4 py-3 text-gray-700 hover:bg-gray-50 border-b border-gray-200"
                >
                  <ProfileIcon />
                  Profile Settings
                </Link>
                <Link
                  to="/"
                  className="flex items-center gap-2 px-4 py-3 text-red-600 hover:bg-red-50 font-semibold rounded-b-lg"
                >
                  <LogoutIcon />
                  Logout
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};
