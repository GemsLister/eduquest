import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient.js";
import { useConfirm } from "./ui/ConfirmModal.jsx";
import eduquestLogo from "../assets/eduquest-logo.png";
import * as Icon from "../assets/svg/sidebar/sidebarIcons.js";

const navItems = [
  {
    name: "Sections",
    path: "/instructor-dashboard",
    icon: <Icon.SectionIcon />,
    end: true,
  },
  {
    name: "Quizzes",
    path: "/instructor-dashboard/quizzes",
    icon: <Icon.QuizIcon />,
  },
  {
    name: "Question Bank",
    path: "/instructor-dashboard/question-bank",
    icon: <Icon.QuestionIcon />,
  },
  {
    name: "Item Analysis",
    path: "/instructor-dashboard/item-difficulty-analysis",
    icon: <Icon.AnalyticsIcon />,
  },
  {
    name: "Profile",
    path: "/instructor-dashboard/instructor-profile",
    icon: <Icon.ProfileIcon />,
  },
  { name: "Logout", path: "/", icon: <Icon.LogoutIcon />, isLogout: true },
];

export const Sidebar = () => {
  const navigate = useNavigate();
  const confirm = useConfirm();

  const handleLogout = async (e) => {
    e.preventDefault();
    const confirmed = await confirm({
      title: "Logout",
      message: "Are you sure you want to logout?",
      confirmText: "Logout",
      cancelText: "Cancel",
      variant: "danger",
    });
    if (confirmed) {
      await supabase.auth.signOut();
      navigate("/");
    }
  };

  return (
    <aside className="group static flex flex-col bg-hornblende-green w-[72px] hover:w-[240px] transition-all duration-300 ease-in-out overflow-hidden shadow-xl z-10">
      {/* Logo */}
      <div className="flex items-center gap-3 py-6 px-4 border-b border-white/10">
        <img
          src={eduquestLogo}
          alt="eduquest-logo"
          className="h-10 w-10 shrink-0 rounded-lg"
        />
        <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 font-black text-white text-lg whitespace-nowrap tracking-wide">
          EduQuest
        </span>
      </div>

      <nav className="flex-1 px-3 mt-4">
        <ul className="flex flex-col gap-2">
          {navItems.map((nav, index) => (
            <li key={index}>
              <NavLink
                to={nav.path}
                end={nav.end}
                onClick={nav.isLogout ? handleLogout : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                    isActive && !nav.isLogout
                      ? "bg-white/20 text-white shadow-inner"
                      : "text-white/60 hover:bg-white/10 hover:text-white"
                  }`
                }
              >
                <span className="shrink-0 flex items-center justify-center w-6 h-6 text-[22px]">
                  {nav.icon}
                </span>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap overflow-hidden text-sm">
                  {nav.name}
                </span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom accent */}
      <div className="px-3 pb-6 mt-auto">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-white/30 text-xs px-3 whitespace-nowrap">
          © 2026 EduQuest
        </div>
      </div>
    </aside>
  );
};
