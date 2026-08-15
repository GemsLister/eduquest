import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

/**
 * QuizWorkflowTimeline
 * Interactive audit trail displaying complete chronological workflow history for quizzes
 * including creator, approver, department head, dates, status transitions, and rejection reasons.
 */
export const QuizWorkflowTimeline = () => {
  const [historyEvents, setHistoryEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedQuizFilter, setSelectedQuizFilter] = useState("all");
  const [quizzesList, setQuizzesList] = useState([]);

  useEffect(() => {
    fetchWorkflowHistory();
  }, []);

  const fetchWorkflowHistory = async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // 1. Attempt to fetch using RPC get_user_quiz_activity_history
      let events = [];
      const { data: rpcData, error: rpcErr } = await supabase.rpc(
        "get_user_quiz_activity_history",
        { p_limit: 150 }
      );

      if (!rpcErr && rpcData) {
        events = rpcData;
      } else {
        // Fallback fetch joining quiz_status_history, quizzes, profiles
        const { data: rawHistory, error: hErr } = await supabase
          .from("quiz_status_history")
          .select(
            "id, quiz_id, previous_status, new_status, changed_by, changed_by_role, reason, created_at, quizzes(id, title, status, is_private, instructor_id)"
          )
          .order("created_at", { ascending: false })
          .limit(150);

        if (!hErr && rawHistory) {
          // Fetch profiles for changed_by and instructor_id
          const userIds = [
            ...new Set(
              rawHistory
                .flatMap((h) => [h.changed_by, h.quizzes?.instructor_id])
                .filter(Boolean)
            ),
          ];

          let profileMap = {};
          if (userIds.length > 0) {
            const { data: profiles } = await supabase
              .from("profiles")
              .select("id, first_name, last_name, email, username, is_admin, is_faculty_head")
              .in("id", userIds);

            (profiles || []).forEach((p) => {
              profileMap[p.id] = p;
            });
          }

          events = rawHistory.map((h) => {
            const cp = profileMap[h.changed_by];
            const op = profileMap[h.quizzes?.instructor_id];
            return {
              history_id: h.id,
              quiz_id: h.quiz_id,
              quiz_title: h.quizzes?.title || "Untitled Quiz",
              quiz_status: h.quizzes?.status || h.new_status,
              is_private: h.quizzes?.is_private || false,
              owner_id: h.quizzes?.instructor_id,
              owner_name: op ? `${op.first_name || ""} ${op.last_name || ""}`.trim() || op.username || op.email : "Instructor",
              previous_status: h.previous_status,
              new_status: h.new_status,
              changed_by: h.changed_by,
              changed_by_name: cp ? `${cp.first_name || ""} ${cp.last_name || ""}`.trim() || cp.username || cp.email : "User",
              changed_by_role: h.changed_by_role || (cp?.is_admin ? "admin" : cp?.is_faculty_head ? "faculty_head" : "instructor"),
              reason: h.reason,
              created_at: h.created_at,
            };
          });
        }
      }

      // Filter out private quizzes created by OTHER instructors unless current user is admin/head
      const { data: currentUserProfile } = await supabase
        .from("profiles")
        .select("is_admin, is_faculty_head")
        .eq("id", user.id)
        .single();

      const isHighRole =
        currentUserProfile?.is_admin || currentUserProfile?.is_faculty_head;

      const filteredAccessibleEvents = events.filter((ev) => {
        if (isHighRole) return true;
        if (ev.is_private) {
          return ev.owner_id === user.id;
        }
        return true;
      });

      setHistoryEvents(filteredAccessibleEvents);

      // Extract unique quiz list for filter dropdown
      const uniqueQuizzesMap = {};
      filteredAccessibleEvents.forEach((ev) => {
        if (ev.quiz_id && !uniqueQuizzesMap[ev.quiz_id]) {
          uniqueQuizzesMap[ev.quiz_id] = ev.quiz_title;
        }
      });
      setQuizzesList(
        Object.entries(uniqueQuizzesMap).map(([id, title]) => ({ id, title }))
      );
    } catch (err) {
      console.error("Error fetching workflow history:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateStr).split(",")[0];
  };

  // Maps new_status to human readable action title and icon
  const getActionDetails = (status, prevStatus) => {
    switch (status) {
      case "draft":
        if (prevStatus === "rejected" || prevStatus === "revision_requested") {
          return {
            title: "Quiz Sent Back for Revision",
            badgeClass: "bg-orange-100 text-orange-800 border-orange-200",
            icon: "📝",
          };
        }
        return {
          title: "Quiz Created / Saved as Draft",
          badgeClass: "bg-slate-100 text-slate-800 border-slate-200",
          icon: "✏️",
        };
      case "submitted_for_review":
      case "waiting_for_approval":
        return {
          title: prevStatus === "rejected" ? "Quiz Resubmitted for Approval" : "Quiz Submitted for Approval",
          badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
          icon: "📤",
        };
      case "forwarded_to_head":
        return {
          title: "Forwarded to Department Head",
          badgeClass: "bg-blue-100 text-blue-900 border-blue-300",
          icon: "↗️",
        };
      case "approved":
      case "faculty_head_approved":
        return {
          title: "Quiz Approved by Department Head",
          badgeClass: "bg-emerald-100 text-emerald-900 border-emerald-300",
          icon: "✅",
        };
      case "rejected":
      case "revision_requested":
        return {
          title: "Quiz Returned / Rejected for Revision",
          badgeClass: "bg-red-100 text-red-900 border-red-300",
          icon: "⚠️",
        };
      case "published":
        return {
          title: "Quiz Published Live",
          badgeClass: "bg-green-100 text-green-900 border-green-300",
          icon: "🚀",
        };
      case "archived":
        return {
          title: "Quiz Archived",
          badgeClass: "bg-gray-200 text-gray-800 border-gray-300",
          icon: "📦",
        };
      default:
        return {
          title: `Status Changed to ${status}`,
          badgeClass: "bg-indigo-100 text-indigo-900 border-indigo-200",
          icon: "🔄",
        };
    }
  };

  const getRoleBadge = (role) => {
    const r = (role || "").toLowerCase();
    if (r === "admin") {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200 uppercase">
          Admin
        </span>
      );
    }
    if (r === "faculty_head") {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200 uppercase">
          Department Head
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase">
        Instructor
      </span>
    );
  };

  // Filtered Events
  const filteredEvents = historyEvents.filter((ev) => {
    if (selectedQuizFilter !== "all" && ev.quiz_id !== selectedQuizFilter) {
      return false;
    }
    if (statusFilter !== "all" && ev.new_status !== statusFilter) {
      return false;
    }
    if (roleFilter !== "all" && ev.changed_by_role !== roleFilter) {
      return false;
    }
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      const titleMatch = ev.quiz_title?.toLowerCase().includes(q);
      const userMatch = ev.changed_by_name?.toLowerCase().includes(q);
      const reasonMatch = ev.reason?.toLowerCase().includes(q);
      if (!titleMatch && !userMatch && !reasonMatch) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Search & Filter Header Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="flex-1 min-w-[240px]">
            <div className="relative">
              <input
                type="text"
                placeholder="Search quiz title, user, or reason..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                🔍
              </span>
            </div>
          </div>

          {/* Quiz Filter */}
          <div className="w-full md:w-56">
            <select
              value={selectedQuizFilter}
              onChange={(e) => setSelectedQuizFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-gold"
            >
              <option value="all">All Examinations ({quizzesList.length})</option>
              {quizzesList.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title}
                </option>
              ))}
            </select>
          </div>

          {/* Action Filter */}
          <div className="w-full md:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-gold"
            >
              <option value="all">All Action Types</option>
              <option value="draft">Draft / Created</option>
              <option value="submitted_for_review">Submitted for Approval</option>
              <option value="forwarded_to_head">Forwarded to Head</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected / Revision</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {/* Role Filter */}
          <div className="w-full md:w-40">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-gold"
            >
              <option value="all">All Roles</option>
              <option value="instructor">Instructor</option>
              <option value="faculty_head">Department Head</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Timeline Stream */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-gold mb-3"></div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Loading Quiz Workflow History...
          </p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <span className="text-4xl mb-2 block">📜</span>
          <h3 className="text-base font-bold text-slate-800">
            No Quiz Workflow Events Found
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Try adjusting your search query or dropdown filters above.
          </p>
        </div>
      ) : (
        <div className="relative pl-6 space-y-6 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
          {filteredEvents.map((ev) => {
            const actionInfo = getActionDetails(
              ev.new_status,
              ev.previous_status
            );

            return (
              <div key={ev.history_id} className="relative group">
                {/* Timeline node icon */}
                <div className="absolute -left-6 top-1 w-6 h-6 rounded-full bg-white border-2 border-brand-navy shadow-sm flex items-center justify-center text-xs z-10">
                  {actionInfo.icon}
                </div>

                {/* Event Card */}
                <div className="bg-white border border-slate-200 hover:border-brand-navy/40 rounded-2xl p-5 shadow-xs transition-all duration-200 space-y-3">
                  {/* Top Bar: Action Badge & Timestamp */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${actionInfo.badgeClass}`}
                      >
                        {actionInfo.title}
                      </span>
                      {ev.is_private && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          🔒 Private Quiz
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                      <span>{formatDate(ev.created_at)}</span>
                      <span>•</span>
                      <span className="font-semibold text-slate-500">
                        {formatRelativeTime(ev.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Body Context: Quiz Title & Performer Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left: Affected Quiz */}
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                        Affected Examination
                      </span>
                      <h4 className="text-base font-black text-brand-navy group-hover:text-brand-indigo transition-colors">
                        {ev.quiz_title}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Quiz Owner: <strong>{ev.owner_name}</strong>
                      </p>
                    </div>

                    {/* Right: Performer Info */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
                          Action Performed By
                        </span>
                        <p className="text-sm font-extrabold text-slate-900">
                          {ev.changed_by_name || "Unknown User"}
                        </p>
                      </div>
                      <div>{getRoleBadge(ev.changed_by_role)}</div>
                    </div>
                  </div>

                  {/* Status Transition Row */}
                  {ev.previous_status && ev.previous_status !== ev.new_status && (
                    <div className="flex items-center gap-2 text-xs bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100 font-medium">
                      <span className="text-slate-500">Status Transition:</span>
                      <span className="px-2 py-0.5 bg-white rounded border border-slate-200 font-bold uppercase text-[10px]">
                        {ev.previous_status}
                      </span>
                      <span className="text-indigo-600 font-bold">→</span>
                      <span className="px-2 py-0.5 bg-brand-navy text-white rounded font-bold uppercase text-[10px]">
                        {ev.new_status}
                      </span>
                    </div>
                  )}

                  {/* Reason / Feedback Callout (if present) */}
                  {ev.reason && (
                    <div className="bg-amber-50 border-l-4 border-amber-400 p-3 rounded-r-xl">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 block mb-0.5">
                        Feedback / Reason Recorded:
                      </span>
                      <p className="text-xs text-amber-950 italic font-medium">
                        "{ev.reason}"
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
