import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import eduquestLogo from "../../assets/eduquest-logo.png";
import { ProfileIcon } from "../../assets/svg/ProfileIcon.jsx";
import { LogoutIcon } from "../../assets/svg/LogoutIcon.jsx";
import { useUsername } from "../../hooks/useUsername.jsx";
import InstructorImage from "../../assets/instructor-profile.png";

export const InstructorLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const userData = useUsername();
  const [profileDropdown, setProfileDropdown] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (path) => {
    if (path === "/instructor-dashboard") {
      return (
        location.pathname === "/instructor-dashboard" ||
        (!location.pathname.includes("instructor-profile") &&
          location.pathname.startsWith("/instructor-dashboard"))
      );
    }
    return location.pathname.includes(path);
  };

  const navItems = [
    {
      name: "Classes",
      path: "/instructor-dashboard",
      icon: "📚",
    },
    {
      name: "Profile",
      path: "/instructor-dashboard/instructor-profile",
      icon: "👤",
    },
  ];

  return (
    <div className="flex h-screen bg-authentic-white">
      {/* Collapsible Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-20"
        } bg-white border-r border-gray-200 shadow-sm transition-all duration-300 ease-in-out hover:w-64 group flex flex-col`}
        onMouseEnter={() => setSidebarOpen(true)}
        onMouseLeave={() => setSidebarOpen(false)}
      >
        {/* Logo Section */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-center h-16">
          <img src={eduquestLogo} alt="EduQuest" className="h-8 w-8" />
          <span
            className={`font-bold text-gray-800 transition-all duration-200 overflow-hidden whitespace-nowrap ${
              sidebarOpen ? "opacity-100 ml-3 w-auto" : "opacity-0 ml-0 w-0"
            }`}
          >
            EduQuest
          </span>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center justify-center py-3 rounded-lg transition-all duration-200 ${
                sidebarOpen ? "justify-start px-4" : "justify-center px-0"
              } ${
                isActive(item.path)
                  ? "bg-blue-50 text-blue-600 font-semibold"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <span className="text-2xl">{item.icon}</span>
              <span
                className={`transition-all duration-200 whitespace-nowrap overflow-hidden ${
                  sidebarOpen ? "opacity-100 ml-4 w-auto" : "opacity-0 ml-0 w-0"
                }`}
              >
                {item.name}
              </span>
            </Link>
          ))}
        </nav>

        {/* Logout Section */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={() => navigate("/")}
            className={`w-full flex items-center py-3 text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 font-medium ${
              sidebarOpen ? "justify-start px-4" : "justify-center px-0"
            }`}
          >
            <LogoutIcon />
            <span
              className={`transition-all duration-200 whitespace-nowrap overflow-hidden ${
                sidebarOpen ? "opacity-100 ml-4 w-auto" : "opacity-0 ml-0 w-0"
              }`}
            >
              Logout
            </span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 shadow-sm px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              {userData.dbName || userData.googleName}
            </h1>
          </div>

          {/* Profile Section */}
          <div className="relative">
            <button
              onClick={() => setProfileDropdown(!profileDropdown)}
              className="flex items-center gap-3 p-2 rounded-full hover:bg-gray-100 transition-colors"
            >
              <img
                src={InstructorImage}
                alt="profile"
                className="h-10 w-10 rounded-full"
              />
            </button>

            {/* Dropdown Menu */}
            {profileDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <Link
                  to="/instructor-dashboard/instructor-profile"
                  className="flex items-center gap-2 px-4 py-3 text-gray-700 hover:bg-gray-50 border-b border-gray-200 rounded-t-lg"
                >
                  <ProfileIcon />
                  Profile Settings
                </Link>
                <button
                  onClick={() => navigate("/")}
                  className="w-full flex items-center gap-2 px-4 py-3 text-red-600 hover:bg-red-50 font-semibold rounded-b-lg"
                >
                  <LogoutIcon />
                  Logout
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
