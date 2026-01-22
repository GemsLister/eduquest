import { NavLink } from "react-router-dom";
import eduquestLogo from "../assets/eduquest-logo.png";
import { DashboardIcon } from "../assets/svg/DashboardIcon.jsx";
import { CreateQuizIcon } from "../assets/svg/CreateQuizIcon.jsx";
import { QuestionIcon } from "../assets/svg/QuestionIcon.jsx";
import { ProfileIcon } from "../assets/svg/ProfileIcon.jsx";
import { DockLeftIcon, DockRightIcon } from "../assets/svg/DockIcons.jsx";
import { LogoutIcon } from "../assets/svg/LogoutIcon.jsx";
import { useState } from "react";
import { useLogout } from "../hooks/useLogout.jsx";

export const Sidebar = () => {
  const handleLogout = useLogout();

  const navs = [
    {
      name: "Home",
      path: "/instructor-dashboard",
      icon: <DashboardIcon />,
    },
    {
      name: "Create Quiz",
      path: "/instructor-quiz",
      icon: <CreateQuizIcon />,
    },
    {
      name: "Questions",
      path: "/instructor-questions",
      icon: <QuestionIcon />,
    },
    {
      name: "Profile",
      path: "/instructor-profile",
      icon: <ProfileIcon />,
    },
    {
      name: "Logout",
      path: "",
      icon: <LogoutIcon />,
      isLogout: true,
    },
  ];
  const [isOpen, setIsOpen] = useState(true);
  return (
    <aside
      className={`flex flex-col bg-porcelain-white transition-all duration-300 ease-in-out ${isOpen ? "w-[300px]" : "w-[80px]"}`}
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
          {isOpen ? <DockLeftIcon /> : <DockRightIcon />}
        </button>
      </div>

      <nav className="flex flex-col justify-between gap-3 h-screen">
        <ul className="flex flex-col justify-center gap-3 p-3">
          {navs.map((nav, index) => (
            <li key={index}>
              {nav.isLogout ? (
                <button
                  onClick={handleLogout}
                  className={`flex items-center gap-3 font-semibold text-[clamp(12px,10dvw,14px)] text-hornblende-green hover:bg-casual-green hover:text-white p-3.5 rounded-md transition-all duration-300 ease-in-out w-full text-left`}
                >
                  {isOpen ? (
                    <div className="flex justify-center items-center gap-3">
                      {nav.icon}
                      {nav.name}
                    </div>
                  ) : (
                    nav.icon
                  )}
                </button>
              ) : (
                <NavLink
                  key={nav.name}
                  to={nav.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 font-semibold text-[clamp(12px,10dvw,14px)] text-hornblende-green hover:bg-casual-green hover:text-white p-3.5 rounded-md transition-all duration-300 ease-in-out ${isActive ? "bg-casual-green text-white" : ""}`
                  }
                  end
                >
                  {isOpen ? (
                    <div className="flex justify-center items-center gap-3">
                      {nav.icon}
                      {nav.name}
                    </div>
                  ) : (
                    nav.icon
                  )}
                </NavLink>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
};
