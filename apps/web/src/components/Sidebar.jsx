import { NavLink } from "react-router-dom";
import eduquestLogo from "../assets/eduquest-logo.png";
import { DockLeftIcon, DockRightIcon } from "../assets/svg/DockIcons.jsx";
import { useState } from "react";

export const Sidebar = ({ navs }) => {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <aside
      className={`flex flex-col bg-porcelain-white transition-all duration-300 ease-in-out ${isOpen ? "w-[300px]" : "w-[80px]"} h-screen`}
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
      <nav className="flex-1 px-3.5">
        <ul className="flex flex-col gap-2">
          {navs?.map((item, index) => (
            <li key={index}>
              <NavLink
                key={item.name}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 font-semibold text-[clamp(12px,10dvw,14px)] text-hornblende-green hover:bg-casual-green hover:text-white p-3.5 rounded-md transition-all duration-300 ease-in-out ${isActive ? "bg-casual-green text-white" : ""}`
                }
                end
              >
                {isOpen ? (
                  <div className="flex justify-center items-center gap-3">
                    {item.icon}
                    {item.name}
                  </div>
                ) : (
                  item.icon
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
};