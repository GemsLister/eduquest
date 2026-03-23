import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient.js";
import { useConfirm } from "../ui/ConfirmModal.jsx";
import citlLogo from "../../assets/BUKSU_CITL.jpg";
const navItems = [
  {
    name: "Dashboard",
    path: "/admin-dashboard",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    end: true,
  },
  {
    name: "Instructors",
    path: "/admin-dashboard/instructors",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    name: "Requests",
    path: "/admin-dashboard/registration-requests",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
        <path d="M9 14l2 2 4-4" />
      </svg>
    ),
  },
  {
    name: "Quiz Reviews",
    path: "/admin-dashboard/quiz-reviews",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    name: "Create Instructor",
    path: "/admin-dashboard/create-instructor",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="8.5" cy="7" r="4" />
        <line x1="20" y1="8" x2="20" y2="14" />
        <line x1="23" y1="11" x2="17" y2="11" />
      </svg>
    ),
  },
  {
    name: "Logout",
    path: "/",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
    ),
    isLogout: true,
  },
];

export const AdminSidebar = () => {
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
    <aside className="group static flex flex-col bg-brand-navy w-[68px] hover:w-[220px] transition-all duration-300 ease-in-out overflow-hidden shadow-xl z-10">
      {/* Logo */}
      <div className="flex items-center gap-3 py-5 px-[14px] border-b border-white/10">
        <img
          src={citlLogo}
          alt="BUKSU CITL logo"
          className="h-9 w-9 shrink-0 rounded-full object-cover"
        />
        <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 font-black text-white text-base whitespace-nowrap tracking-wide">
          BUKSU CITL
        </span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2 py-3">
        <ul className="flex flex-col gap-1">
          {navItems.map((nav) => (
            <li key={nav.name}>
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
          © 2026 BUKSU CITL
        </div>
      </div>
    </aside>
  );
};
