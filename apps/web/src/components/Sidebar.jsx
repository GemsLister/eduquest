import { NavLink } from "react-router-dom";
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
  { name: "Logout", path: "/", icon: <Icon.LogoutIcon /> },
];

export const Sidebar = () => {
  return (
    <aside className="group static flex flex-col bg-hornblende-green w-[68px] hover:w-[220px] transition-all duration-300 ease-in-out overflow-hidden shadow-xl z-10">
      {/* Logo */}
      <div className="flex items-center gap-3 py-5 px-[14px] border-b border-white/10">
        <img
          src={eduquestLogo}
          alt="eduquest-logo"
          className="h-9 w-9 shrink-0 rounded-lg"
        />
        <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 font-black text-white text-base whitespace-nowrap tracking-wide">
          EduQuest
        </span>
      </div>

      <nav className="flex-1 px-3.5">
        <ul className="flex flex-col gap-2">
          {navItems.map((nav, index) => (
            <li key={index}>
              <NavLink
                to={nav.path}
                end={nav.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                    isActive
                      ? "bg-white/20 text-white shadow-inner"
                      : "text-white/60 hover:bg-white/10 hover:text-white"
                  }`
                }
              >
                <span className="shrink-0 text-[18px]">{nav.icon}</span>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap overflow-hidden text-sm">
                  {nav.name}
                </span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom accent */}
      <div className="px-2 pb-4">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-white/30 text-[10px] px-3 whitespace-nowrap">
          © 2026 EduQuest
        </div>
      </div>
    </aside>
  );
};

