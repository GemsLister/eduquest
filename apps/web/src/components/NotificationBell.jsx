import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useEscapeKey } from "../hooks/useEscapeKey.jsx";

/**
 * Notification links are written by whoever triggers them and often point at
 * the instructor portal. Map them onto the portal the reader is actually in so
 * Senior Faculty aren't bounced by the route guard, and fix legacy links.
 */
const resolveNotificationLink = (link, pathname) => {
  if (!link) return null;
  const target = link.replace(/^\/faculty-head\//, "/faculty-head-dashboard/");

  // Department Head pages aren't reachable from the other portals; send the
  // reader to their own Subjects page (subject-request updates) instead.
  if (target.startsWith("/faculty-head-dashboard") && !pathname.startsWith("/faculty-head-dashboard")) {
    return pathname.startsWith("/admin-dashboard") ? "/admin-dashboard/subjects" : "/instructor-dashboard";
  }

  if (pathname.startsWith("/admin-dashboard") && target.startsWith("/instructor-dashboard")) {
    const rest = target.slice("/instructor-dashboard".length);
    const peer = rest.match(/^\/peer-reviews(\/[^?]*)?/);
    if (peer) return `/admin-dashboard/quiz-reviews${peer[1] || ""}`;
    if (rest === "" || rest === "/") return "/admin-dashboard/subjects";
    if (rest.startsWith("/instructor-quiz")) {
      return `/admin-dashboard/create-quiz${rest.slice("/instructor-quiz".length)}`;
    }
    if (rest.startsWith("/instructor-profile")) return "/admin-dashboard/profile";
    return `/admin-dashboard${rest}`;
  }
  return target;
};

// Subject-request notifications store a JSON payload in `message` (it's parsed
// elsewhere), so render those as a sentence instead of raw JSON.
const formatNotificationMessage = (message) => {
  if (typeof message !== "string" || !message.trim().startsWith("{")) return message;
  try {
    const p = JSON.parse(message);
    const name = p.subject_name ? `"${p.subject_name}"` : "A subject";
    if (p.request_status === "approved") return `${name} was approved and added to your subjects.`;
    if (p.request_status === "rejected") {
      return `${name} was not approved${p.rejection_reason ? `: ${p.rejection_reason}` : "."}`;
    }
    if (p.request_status === "pending") {
      return `${p.requester_name || "An instructor"} requested ${name}${p.grade_level ? ` (${p.grade_level} year)` : ""}.`;
    }
    return message;
  } catch {
    return message;
  }
};

// Subject requests keep a copy of the request in the requester's own
// notifications ("My Subject Request: ...") so they can track it. That row is
// storage, not news, so it stays out of the bell.
const SELF_TRACKING_PREFIX = "My Subject Request:";
const isSelfTracking = (n) => typeof n?.title === "string" && n.title.startsWith(SELF_TRACKING_PREFIX);

// Pages and sidebar badges refresh on these; a new notification usually means
// one of them is out of date (a review decision, an assignment, a subject request)
const REFRESH_EVENTS = [
  "submissions-changed",
  "pending-peer-reviews-changed",
  "pending-quiz-reviews-changed",
  "pending-quiz-approvals-changed",
  "pending-subject-requests-changed",
  "pending-requests-changed",
  "subject-requests-changed",
  "subjects-changed",
];

const fetchNotifications = async (userId) => {
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .not("title", "ilike", `${SELF_TRACKING_PREFIX}%`)
    .order("created_at", { ascending: false })
    .limit(20);

  // Unread total across all notifications, not only the 20 shown
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false)
    .not("title", "ilike", `${SELF_TRACKING_PREFIX}%`);

  return {
    list: data || null,
    unread: count ?? (data || []).filter((n) => !n.is_read).length,
  };
};

export const NotificationBell = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [syncKey, setSyncKey] = useState(0);
  const dropdownRef = useRef(null);

  useEscapeKey(() => {
    setOpen(false);
    setMenuOpenId(null);
  }, open);

  const userId = user?.id;

  // Load on sign-in and re-sync whenever the dropdown opens (covers missed
  // realtime events and changes made in another tab)
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchNotifications(userId).then(({ list, unread }) => {
      if (cancelled) return;
      if (list) setNotifications(list);
      setUnreadCount(unread);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, syncKey]);

  useEffect(() => {
    if (!userId) return;

    // Subscribe to this user's real-time notifications only
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const incoming = payload.new;
          if (isSelfTracking(incoming)) return;
          setNotifications((prev) =>
            prev.some((n) => n.id === incoming.id) ? prev : [incoming, ...prev],
          );
          if (!incoming.is_read) setUnreadCount((prev) => prev + 1);
          REFRESH_EVENTS.forEach((name) => window.dispatchEvent(new Event(name)));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Keep the relative times current while the list is showing
  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, [open]);

  const toggleOpen = () => {
    if (!open) {
      setNow(Date.now());
      setSyncKey((k) => k + 1);
    }
    setOpen(!open);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
        setMenuOpenId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAsRead = async (id) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    if (!user) return;

    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false)
      .not("title", "ilike", `${SELF_TRACKING_PREFIX}%`);

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const handleNotificationClick = (notification) => {
    setMenuOpenId(null);
    if (!notification.is_read) markAsRead(notification.id);
    const target = resolveNotificationLink(notification.link, location.pathname);
    if (target) navigate(target);
    setOpen(false);
  };

  const deleteNotification = async (e, id) => {
    e.stopPropagation();
    const wasUnread = notifications.find((n) => n.id === id && !n.is_read);
    await supabase.from("notifications").delete().eq("id", id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1));
    setMenuOpenId(null);
  };

  const getTypeStyle = (type) => {
    switch (type) {
      case "success":
        return { bg: "bg-green-100", color: "text-green-600", icon: "M5 13l4 4L19 7" };
      case "warning":
        return { bg: "bg-amber-100", color: "text-amber-600", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" };
      case "error":
        return { bg: "bg-red-100", color: "text-red-600", icon: "M6 18L18 6M6 6l12 12" };
      default:
        return { bg: "bg-brand-navy/10", color: "text-brand-navy", icon: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" };
    }
  };

  const timeAgo = (dateStr) => {
    const diff = Math.max(0, now - new Date(dateStr).getTime());
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={toggleOpen}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-expanded={open}
        className="relative p-2 text-gray-500 hover:text-brand-navy transition-colors rounded-lg hover:bg-brand-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-brand-gold text-brand-navy text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="fixed left-4 right-4 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-brand-navy">
            <h3 className="font-bold text-white text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-brand-gold hover:text-brand-gold-dark font-semibold"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => {
                const style = getTypeStyle(n.type);
                return (
                  <div
                    key={n.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleNotificationClick(n)}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleNotificationClick(n);
                      }
                    }}
                    className={`relative w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-gold/60 ${
                      !n.is_read ? "bg-brand-gold/5" : ""
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${style.bg}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${style.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d={style.icon} />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p
                            className={`text-sm font-semibold truncate ${!n.is_read ? "text-brand-navy" : "text-gray-600"}`}
                          >
                            {n.title}
                          </p>
                          {!n.is_read && (
                            <span className="w-2 h-2 bg-brand-gold rounded-full shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                          {formatNotificationMessage(n.message)}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1">
                          {timeAgo(n.created_at)}
                        </p>
                      </div>

                      {/* 3-dot menu */}
                      <div className="relative shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId(menuOpenId === n.id ? null : n.id);
                          }}
                          aria-label="Notification options"
                          aria-expanded={menuOpenId === n.id}
                          className="p-1 rounded-full hover:bg-gray-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </button>
                        {menuOpenId === n.id && (
                          <div className="absolute right-0 mt-1 w-32 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden">
                            <button
                              onClick={(e) => deleteNotification(e, n.id)}
                              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
