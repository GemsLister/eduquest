import { NavLink } from "react-router-dom";
import eduquestLogo from "../assets/eduquest-logo.png";
import { useState } from "react";
import * as Icon from "../assets/svg/sidebar/sidebarIcons.js";

export const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <aside
      className={`static flex flex-col bg-porcelain-white transition-all duration-300 ease-in-out ${isOpen ? "w-[300px]" : "w-[80px]"}`}
    >
      <div
        className={`flex ${isOpen ? "justify-between" : "justify-center"} w-full py-6 px-3`}
      >
        <img
          src={eduquestLogo}
          alt="eduquest-logo"
          className={`h-[clamp(30px,13dvw,45px)] w-[clamp(30px,13dvw,50px)] transition-all duration-300 ease-in-out ${isOpen ? "block" : "hidden"}`}
        />
        <button
          onClick={() => setIsOpen(!isOpen)}
          resize="24px"
          className="text-[clamp(14px,10dvw,20px)] text-hornblende-green hover:text-white rounded-md hover:bg-casual-green p-2 transition-all duration-300 ease-in-out"
        >
          {isOpen ? <Icon.DockLeftIcon /> : <Icon.DockRightIcon />}
        </button>
      </div>
      <nav className="flex-1 px-3.5">
        <ul className="flex flex-col gap-2">
          {[
            {
              name: "Sections",
              path: "/instructor-dashboard",
              icon: <Icon.SectionIcon />,
            },
            {
              name: "Questions",
              path: "/instructor-dashboard/instructor-questions",
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
            {
              name: "Logout",
              path: "/",
              icon: <Icon.LogoutIcon />,
            },
          ].map((navs, index) => (
            <li key={index}>
              <NavLink
                key={navs.name}
                to={navs.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 font-semibold text-[clamp(12px,10dvw,14px)] text-hornblende-green hover:bg-casual-green hover:text-white p-3.5 rounded-md transition-all duration-300 ease-in-out ${isActive ? "bg-casual-green text-white" : ""}`
                }
                end={navs.path === "/instructor-dashboard" ? true : false}
              >
                {isOpen ? (
                  <div className="flex justify-center items-center gap-3">
                    {navs.icon}
                    {navs.name}
                  </div>
                ) : (
                  navs.icon
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
};
