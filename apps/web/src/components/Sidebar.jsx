import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient.js";
import { useConfirm } from "./ui/ConfirmModal.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import citlLogo from "../assets/BUKSU_CITL.jpg";
import { useUnseenCount } from "../hooks/useUnseenBadge.js";

const Icon = ({ children }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const icons = {
  subjects: (
    <Icon>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </Icon>
  ),
  teaching: (
    <Icon>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </Icon>
  ),
  submissions: (
    <Icon>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M9 14l2 2 4-4" />
    </Icon>
  ),
  history: (
    <Icon>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </Icon>
  ),
  profile: (
    <Icon>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </Icon>
  ),
  logout: (
    <Icon>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </Icon>
  ),
  chevron: (
    <Icon>
      <polyline points="6 9 12 15 18 9" />
    </Icon>
  ),
  collapse: (
    <Icon>
      <polyline points="11 17 6 12 11 7" />
      <polyline points="18 17 13 12 18 7" />
    </Icon>
  ),
};

/**
 * `match` lists extra path prefixes that count as "this page" (e.g. a quiz's
 * editor/results belong to Quizzes). `badge` names a count kept in state below.
 */
const navSections = [
  { name: "Subjects", path: "/instructor-dashboard", icon: icons.subjects, exact: true, match: ["/instructor-dashboard/section"] },
  {
    name: "Teaching",
    icon: icons.teaching,
    children: [
      {
        name: "Exams",
        path: "/instructor-dashboard/exams",
        match: ["/instructor-dashboard/instructor-exam", "/instructor-dashboard/exam-results"],
      },
      { name: "Question Bank", path: "/instructor-dashboard/question-bank" },
      { name: "Item Analysis", path: "/instructor-dashboard/item-difficulty-analysis" },
      { name: "Student Profiles", path: "/instructor-dashboard/student-profiles" },
    ],
  },
  {
    name: "Submissions & Reviews",
    path: "/instructor-dashboard/my-submissions",
    icon: icons.submissions,
    badge: "submissions",
  },
  { name: "History", path: "/instructor-dashboard/history", icon: icons.history },
];

const PINNED_KEY = "instructorSidebarPinned";

const readPinned = () => {
  try {
    return localStorage.getItem(PINNED_KEY) === "1";
  } catch {
    return false;
  }
};

const isPathActive = (pathname, item) => {
  if (item.exact) {
    if (pathname === item.path || pathname === `${item.path}/`) return true;
    return (item.match || []).some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
  }
  return [item.path, ...(item.match || [])].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
};

// `display` carries the display utility so callers can hide it responsively
const CountBadge = ({ count, small = false, display = "flex", className = "" }) =>
  count > 0 ? (
    <span
      className={`${display} items-center justify-center px-1 bg-red-500 text-white font-bold rounded-full ${
        small ? "min-w-[16px] h-4 text-[9px]" : "min-w-[18px] h-[18px] text-[10px]"
      } ${className}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  ) : null;

// mobileOpen/onNavigate come from PortalLayout (drawer on small screens)
export const Sidebar = ({ mobileOpen = false, onNavigate }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const confirm = useConfirm();
  const { user } = useAuth();
  // Peer reviews to do + revision requests to address, as "kind:id:status" keys
  const [submissionItemKeys, setSubmissionItemKeys] = useState([]);
  // Desktop: collapsed to an icon rail that widens on hover, or pinned open
  const [pinned, setPinned] = useState(readPinned);
  // Groups the user opened or closed; untouched groups follow the current page
  const [groupOverrides, setGroupOverrides] = useState({});

  // Badges clear once the Submissions & Reviews page has been viewed
  const submissionNotifCount = useUnseenCount(user?.id, "submissions", submissionItemKeys, [
    "/instructor-dashboard/my-submissions",
    "/instructor-dashboard/peer-reviews",
  ]);

  const badgeCounts = {
    submissions: submissionNotifCount,
  };

  // Labels always show in the mobile drawer; on desktop only when pinned or hovered
  const labelVisibility = pinned
    ? "opacity-100"
    : "opacity-100 md:opacity-0 md:group-hover:opacity-100";
  // Submenus hide on the collapsed icon rail
  const submenuVisibility = pinned ? "" : "md:hidden md:group-hover:grid";

  const togglePinned = () => {
    setPinned((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(PINNED_KEY, next ? "1" : "0");
      } catch {
        // Storage blocked: the choice just won't be remembered
      }
      return next;
    });
  };

  useEffect(() => {
    if (!user?.id) return;
    const fetchNotificationCount = async () => {
      try {
        // 1. Pending peer reviews assigned to this instructor
        const { data: peerSubs } = await supabase
          .from("quiz_analysis_submissions")
          .select("id")
          .eq("assigned_reviewer_id", user.id)
          .eq("status", "pending");

        // 2. Revision requests on this instructor's submissions that haven't
        //    been resubmitted yet (a resubmission points back via previous_submission_id)
        const { data: ownSubs } = await supabase
          .from("quiz_analysis_submissions")
          .select("id, status, previous_submission_id")
          .eq("instructor_id", user.id);
        const resubmittedIds = new Set(
          (ownSubs || []).map((s) => s.previous_submission_id).filter(Boolean),
        );
        const revSubs = (ownSubs || []).filter(
          (s) => s.status === "revision_requested" && !resubmittedIds.has(s.id),
        );

        setSubmissionItemKeys([
          ...(peerSubs || []).map((s) => `peer:${s.id}:pending`),
          ...revSubs.map((s) => `rev:${s.id}:revision_requested`),
        ]);
      } catch (err) {
        console.warn("Could not fetch submission notification count:", err);
      }
    };

    fetchNotificationCount();
    window.addEventListener("pending-peer-reviews-changed", fetchNotificationCount);
    window.addEventListener("pending-quiz-reviews-changed", fetchNotificationCount);
    window.addEventListener("submissions-changed", fetchNotificationCount);
    window.addEventListener("quiz-submissions-updated", fetchNotificationCount);
    return () => {
      window.removeEventListener("pending-peer-reviews-changed", fetchNotificationCount);
      window.removeEventListener("pending-quiz-reviews-changed", fetchNotificationCount);
      window.removeEventListener("submissions-changed", fetchNotificationCount);
      window.removeEventListener("quiz-submissions-updated", fetchNotificationCount);
    };
  }, [user?.id]);

  const handleLogout = async () => {
    const confirmed = await confirm({
      title: "Are you sure you want to log out?",
      confirmText: "Logout",
      cancelText: "Cancel",
      variant: "danger",
    });
    if (confirmed) {
      await supabase.auth.signOut();
      navigate("/");
    }
  };

  const topLevelClass = (active) =>
    `flex items-center gap-3 w-full px-3 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-gold/60 ${
      active
        ? "bg-brand-gold/15 text-brand-gold border-brand-gold/30 shadow-xs"
        : "text-white/70 hover:bg-white/10 hover:text-white border-transparent"
    }`;

  const renderLink = (item) => {
    const active = isPathActive(pathname, item);
    const count = item.badge ? badgeCounts[item.badge] || 0 : 0;
    return (
      <Link
        to={item.path}
        onClick={onNavigate}
        title={item.name}
        aria-current={active ? "page" : undefined}
        className={topLevelClass(active)}
      >
        <span className="relative shrink-0">
          {item.icon}
          <CountBadge count={count} small className="absolute -top-2 -right-2" />
        </span>
        <span className={`${labelVisibility} flex-1 transition-opacity duration-200 whitespace-nowrap overflow-hidden`}>
          {item.name}
        </span>
      </Link>
    );
  };

  const renderGroup = (group) => {
    const groupActive = group.children.some((child) => isPathActive(pathname, child));
    const isOpen = groupOverrides[group.name] ?? groupActive;
    const groupBadge = group.children.reduce(
      (sum, child) => sum + (child.badge ? badgeCounts[child.badge] || 0 : 0),
      0,
    );
    const submenuId = `instr-nav-${group.name.toLowerCase().replace(/\s+/g, "-")}`;

    return (
      <>
        <button
          type="button"
          onClick={() => setGroupOverrides((prev) => ({ ...prev, [group.name]: !isOpen }))}
          aria-expanded={isOpen}
          aria-controls={submenuId}
          title={group.name}
          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl font-bold text-sm text-left transition-all duration-200 border border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-gold/60 ${
            groupActive ? "text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
          }`}
        >
          <span className="relative shrink-0">
            {group.icon}
            {/* Counts stay visible when the group is closed or the rail is collapsed */}
            <CountBadge
              count={groupBadge}
              small
              display={isOpen ? (pinned ? "hidden" : "hidden md:flex md:group-hover:hidden") : "flex"}
              className="absolute -top-2 -right-2"
            />
          </span>
          <span className={`${labelVisibility} flex-1 transition-opacity duration-200 whitespace-nowrap overflow-hidden`}>
            {group.name}
          </span>
          <span
            className={`${labelVisibility} shrink-0 transition-all duration-200 ${isOpen ? "rotate-180" : ""}`}
          >
            {icons.chevron}
          </span>
        </button>

        {/* Submenu: grid-rows animates the height open and closed */}
        <div
          id={submenuId}
          className={`${submenuVisibility} grid transition-[grid-template-rows] duration-200 ease-in-out ${
            isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <ul className="overflow-hidden" inert={!isOpen}>
            {group.children.map((child) => {
              const active = isPathActive(pathname, child);
              const count = child.badge ? badgeCounts[child.badge] : 0;
              return (
                <li key={child.path}>
                  <Link
                    to={child.path}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2 mt-0.5 ml-[21px] pl-[19px] pr-3 py-2 border-l-2 rounded-r-lg text-[13px] whitespace-nowrap transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-gold/60 ${
                      active
                        ? "border-brand-gold text-brand-gold font-bold bg-brand-gold/10"
                        : "border-white/10 text-white/60 font-semibold hover:text-white hover:bg-white/5 hover:border-white/30"
                    }`}
                  >
                    <span className="truncate">{child.name}</span>
                    <CountBadge count={count} className="ml-auto" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </>
    );
  };

  return (
    <aside
      className={`group fixed inset-y-0 left-0 z-40 w-[240px] md:static md:z-10 md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"} ${pinned ? "md:w-[240px]" : "md:w-[68px] md:hover:w-[240px]"} flex flex-col bg-brand-navy transition-all duration-300 ease-in-out overflow-hidden shadow-xl`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 py-5 px-[14px] border-b border-white/10">
        <img
          src={citlLogo}
          alt="BUKSU CITL logo"
          className="h-9 w-9 shrink-0 rounded-full object-cover"
        />
        <span className={`${labelVisibility} transition-opacity duration-200 font-black text-white text-base whitespace-nowrap tracking-wide`}>
          BUKSU CITL
        </span>
      </div>

      {/* Nav items */}
      <nav aria-label="Instructor" className="flex-1 px-2 py-3 overflow-y-auto overflow-x-hidden">
        <ul className="flex flex-col gap-1">
          {navSections.map((section) => (
            <li key={section.name}>
              {section.children ? renderGroup(section) : renderLink(section)}
            </li>
          ))}
        </ul>
      </nav>

      {/* Account + collapse controls */}
      <div className="px-2 py-3 border-t border-white/10 flex flex-col gap-1">
        {renderLink({ name: "Profile", path: "/instructor-dashboard/instructor-profile", icon: icons.profile })}
        <button type="button" onClick={handleLogout} title="Logout" className={topLevelClass(false)}>
          <span className="shrink-0">{icons.logout}</span>
          <span className={`${labelVisibility} transition-opacity duration-200 whitespace-nowrap overflow-hidden`}>
            Logout
          </span>
        </button>
        <button
          type="button"
          onClick={togglePinned}
          aria-pressed={pinned}
          title={pinned ? "Collapse sidebar" : "Keep sidebar open"}
          className="hidden md:flex items-center gap-3 w-full px-3 py-2 rounded-xl text-xs font-semibold text-white/40 hover:text-white hover:bg-white/10 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-gold/60"
        >
          <span className={`shrink-0 transition-transform duration-300 ${pinned ? "" : "rotate-180"}`}>
            {icons.collapse}
          </span>
          <span className={`${labelVisibility} transition-opacity duration-200 whitespace-nowrap overflow-hidden`}>
            {pinned ? "Collapse sidebar" : "Keep sidebar open"}
          </span>
        </button>
      </div>
    </aside>
  );
};
