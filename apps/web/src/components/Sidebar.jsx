import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient.js";
import { useConfirm } from "./ui/ConfirmModal.jsx";
import citlLogo from "../assets/BUKSU_CITL.jpg";

const navItems = [
  {
    name: "Subjects",
    path: "/instructor-dashboard",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <line x1="12" y1="6" x2="12" y2="12" />
        <line x1="9" y1="9" x2="15" y2="9" />
      </svg>
    ),
    end: true,
  },
  {
    name: "Quizzes",
    path: "/instructor-dashboard/quizzes",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    name: "Question Bank",
    path: "/instructor-dashboard/question-bank",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  {
    name: "Item Analysis",
    path: "/instructor-dashboard/item-difficulty-analysis",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    name: "My Submissions",
    path: "/instructor-dashboard/my-submissions",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="18" x2="12" y2="12" />
        <polyline points="9 15 12 12 15 15" />
      </svg>
    ),
  },
  {
    name: "Profile",
    path: "/instructor-dashboard/instructor-profile",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    name: "Logout",
    path: "/",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
    ),
    isLogout: true,
  },
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
    <aside className="group static flex flex-col bg-brand-navy w-[72px] hover:w-[240px] transition-all duration-300 ease-in-out overflow-hidden shadow-xl z-10 rounded-r-2xl">
      {/* Logo */}
      <div className="flex items-center gap-3 py-6 px-4 border-b border-white/10">
        <img
          src={citlLogo}
          alt="citl-logo"
          className="h-10 w-10 shrink-0 rounded-full object-cover"
        />
        <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 font-black text-white text-lg whitespace-nowrap tracking-wide">
          BUKSU CITL
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
                      ? "bg-brand-gold/20 text-brand-gold shadow-inner"
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
          © 2026 BUKSU CITL
        </div>
      </div>
    </aside>
  );
};
