import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

/**
 * SystemActivityTimeline
 * Comprehensive, append-only General System Activity Audit Trail UI component.
 * Displays WHO did WHAT, WHICH ITEM was affected, WHEN it happened, PREVIOUS/NEW STATE,
 * and REASON/CHANGE DETAILS. Includes expandable [View Details] drawer and rich filters.
 */
export const SystemActivityTimeline = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [activeDetailLog, setActiveDetailLog] = useState(null);

  useEffect(() => {
    fetchSystemActivityLogs();
  }, []);

  const fetchSystemActivityLogs = async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // 1. Try to fetch using RPC get_unified_system_activity
      let rawData = [];
      const { data: rpcData, error: rpcErr } = await supabase.rpc(
        "get_unified_system_activity",
        { p_limit: 200 }
      );

      if (!rpcErr && rpcData) {
        rawData = rpcData;
      } else {
        // Fallback: Fetch directly from audit_trail with joins
        const { data: auditRows, error: aErr } = await supabase
          .from("audit_trail")
          .select(
            "id, action, table_name, record_id, item_name, subject_name, section_name, previous_status, new_status, reason, change_summary, user_id, user_role, new_values, created_at"
          )
          .order("created_at", { ascending: false })
          .limit(200);

        if (!aErr && auditRows) {
          const userIds = [...new Set(auditRows.map((r) => r.user_id).filter(Boolean))];
          let profileMap = {};

          if (userIds.length > 0) {
            const { data: profiles } = await supabase
              .from("profiles")
              .select("id, first_name, last_name, username, email, is_admin, is_faculty_head")
              .in("id", userIds);

            (profiles || []).forEach((p) => {
              profileMap[p.id] = p;
            });
          }

          // Fetch quizzes for context
          const quizIds = [...new Set(auditRows.filter(r => r.table_name === 'quizzes').map(r => r.record_id).filter(Boolean))];
          let quizMap = {};
          if (quizIds.length > 0) {
            const { data: quizzes } = await supabase
              .from("quizzes")
              .select("id, title, is_private, instructor_id, sections(name), subjects(name)")
              .in("id", quizIds);

            (quizzes || []).forEach((q) => {
              quizMap[q.id] = q;
            });
          }

          rawData = auditRows.map((r) => {
            const prof = profileMap[r.user_id];
            const q = quizMap[r.record_id];
            const fullName = prof
              ? `${prof.first_name || ""} ${prof.last_name || ""}`.trim() || prof.username || prof.email
              : "System User";

            return {
              log_id: r.id,
              action: r.action,
              table_name: r.table_name,
              record_id: r.record_id,
              item_name: r.item_name || q?.title || r.new_values?.quizTitle || "System Item",
              subject_name: r.subject_name || q?.subjects?.name || "General Subject",
              section_name: r.section_name || q?.sections?.name || "General Section",
              previous_status: r.previous_status || r.new_values?.previousStatus,
              new_status: r.new_status || r.new_values?.status,
              reason: r.reason || r.new_values?.reason || r.new_values?.feedback,
              change_summary: r.change_summary || r.new_values?.changeSummary,
              user_id: r.user_id,
              user_full_name: fullName,
              user_role: r.user_role || (prof?.is_admin ? "admin" : prof?.is_faculty_head ? "faculty_head" : "instructor"),
              is_private_item: q?.is_private || false,
              owner_id: q?.instructor_id || r.user_id,
              created_at: r.created_at,
            };
          });
        }
      }

      setLogs(rawData || []);
    } catch (err) {
      console.error("Error fetching system activity logs:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-US", {
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
    return formatDate(dateStr);
  };

  // Convert internal action key to Human-Readable Title & Icon
  const getActionInfo = (actionKey) => {
    const act = (actionKey || "").toUpperCase();

    if (act.includes("CREATED") && act.includes("QUIZ")) {
      return { label: "Created a quiz", badge: "bg-emerald-100 text-emerald-900 border-emerald-300", icon: "➕" };
    }
    if (act.includes("EDITED") || act.includes("UPDATED")) {
      return { label: "Edited a quiz", badge: "bg-blue-100 text-blue-900 border-blue-300", icon: "✏️" };
    }
    if (act.includes("SUBMITTED") || act.includes("REVIEW_REQUESTED")) {
      return { label: "Submitted a quiz for review", badge: "bg-amber-100 text-amber-900 border-amber-300", icon: "📤" };
    }
    if (act.includes("FORWARDED")) {
      return { label: "Forwarded quiz to Head", badge: "bg-indigo-100 text-indigo-900 border-indigo-300", icon: "↗️" };
    }
    if (act.includes("REVISION") || act.includes("REJECTED")) {
      return { label: "Returned quiz for revision", badge: "bg-red-100 text-red-900 border-red-300", icon: "⚠️" };
    }
    if (act.includes("APPROVED")) {
      return { label: "Approved a quiz", badge: "bg-green-100 text-green-900 border-green-300", icon: "✅" };
    }
    if (act.includes("PUBLISHED")) {
      return { label: "Published a quiz", badge: "bg-teal-100 text-teal-900 border-teal-300", icon: "🚀" };
    }
    if (act.includes("UNPUBLISHED")) {
      return { label: "Unpublished a quiz", badge: "bg-slate-100 text-slate-800 border-slate-300", icon: "🔒" };
    }
    if (act.includes("ARCHIVED")) {
      return { label: "Archived a quiz", badge: "bg-gray-200 text-gray-800 border-gray-300", icon: "📦" };
    }
    if (act.includes("RESTORED")) {
      return { label: "Restored a quiz", badge: "bg-sky-100 text-sky-900 border-sky-300", icon: "♻️" };
    }
    if (act.includes("QUESTION_CREATED") || act.includes("ADD_QUESTION")) {
      return { label: "Created a question", badge: "bg-purple-100 text-purple-900 border-purple-300", icon: "❓" };
    }
    if (act.includes("QUESTION_BANK")) {
      return { label: "Added to Question Bank", badge: "bg-amber-100 text-amber-900 border-amber-300", icon: "📚" };
    }
    if (act.includes("ITEM_FLAGGED") || act.includes("ANALYSIS")) {
      return { label: "Flagged item in Item Analysis", badge: "bg-rose-100 text-rose-900 border-rose-300", icon: "🚩" };
    }

    // Default formatting: Replace underscores with spaces
    const defaultLabel = actionKey.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return { label: defaultLabel, badge: "bg-slate-100 text-slate-800 border-slate-300", icon: "📜" };
  };

  const getRoleBadge = (role) => {
    const r = (role || "").toLowerCase();
    if (r === "admin") {
      return <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200 uppercase">Admin</span>;
    }
    if (r === "faculty_head") {
      return <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200 uppercase">Department Head</span>;
    }
    if (r === "senior_faculty") {
      return <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200 uppercase">Senior Faculty</span>;
    }
    return <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase">Instructor</span>;
  };

  // Pagination State
  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  // Reset pagination when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, roleFilter]);

  // Filtering
  const filteredLogs = logs.filter((log) => {
    if (roleFilter !== "all" && (log.user_role || "").toLowerCase() !== roleFilter) {
      return false;
    }
    if (categoryFilter !== "all") {
      const act = (log.action || "").toUpperCase();
      if (categoryFilter === "workflows" && !act.includes("SUBMIT") && !act.includes("APPROV") && !act.includes("REJECT") && !act.includes("FORWARD") && !act.includes("REVISION")) return false;
      if (categoryFilter === "edits" && !act.includes("CREATED") && !act.includes("EDITED") && !act.includes("UPDATE")) return false;
      if (categoryFilter === "questions" && !act.includes("QUESTION") && !act.includes("BANK")) return false;
      if (categoryFilter === "publishing" && !act.includes("PUBLISH") && !act.includes("ARCHIVE")) return false;
    }
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      const actionInfo = getActionInfo(log.action);
      const matchLabel = actionInfo.label.toLowerCase().includes(q);
      const matchUser = (log.user_full_name || "").toLowerCase().includes(q);
      const matchItem = (log.item_name || "").toLowerCase().includes(q);
      const matchReason = (log.reason || "").toLowerCase().includes(q);
      if (!matchLabel && !matchUser && !matchItem && !matchReason) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="flex-1 min-w-[240px]">
            <div className="relative">
              <input
                type="text"
                placeholder="Search user, action, quiz, or reason..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                🔍
              </span>
            </div>
          </div>

          {/* Action Category Filter */}
          <div className="w-full md:w-56">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-gold"
            >
              <option value="all">All Action Categories</option>
              <option value="workflows">Approvals & Review Workflows</option>
              <option value="edits">Creations & Edits</option>
              <option value="publishing">Publishing & Archiving</option>
              <option value="questions">Questions & Question Bank</option>
            </select>
          </div>

          {/* Role Filter */}
          <div className="w-full md:w-44">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-gold"
            >
              <option value="all">All Roles</option>
              <option value="instructor">Instructor</option>
              <option value="faculty_head">Department Head</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Activity Timeline Stream */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-gold mb-3"></div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Loading Activity Audit Log...
          </p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <span className="text-4xl mb-2 block">📜</span>
          <h3 className="text-base font-bold text-slate-800">
            No System Activity Records Found
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Try adjusting your search criteria or dropdown filters above.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative pl-6 space-y-4 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
            {paginatedLogs.map((log) => {
              const actionInfo = getActionInfo(log.action);

              return (
                <div key={log.log_id} className="relative group">
                  {/* Timeline node icon */}
                  <div className="absolute -left-6 top-1.5 w-6 h-6 rounded-full bg-white border-2 border-brand-navy shadow-xs flex items-center justify-center text-xs z-10">
                    {actionInfo.icon}
                  </div>

                  {/* Main Card */}
                  <div className="bg-white border border-slate-200 hover:border-brand-navy/40 rounded-2xl p-4 shadow-xs transition-all duration-200 space-y-2.5">
                    {/* Summary Header Line */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider border ${actionInfo.badge}`}>
                          {actionInfo.label}
                        </span>
                        {getRoleBadge(log.user_role)}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                        <span>{formatDate(log.created_at)}</span>
                        <span>•</span>
                        <span>{formatTime(log.created_at)}</span>
                        <span>({formatRelativeTime(log.created_at)})</span>
                      </div>
                    </div>

                    {/* Sentential Statement */}
                    <div className="text-sm font-semibold text-slate-800">
                      <span className="font-extrabold text-brand-navy">{log.user_full_name || "System User"}</span>
                      {" "}{actionInfo.label.toLowerCase()}{" "}
                      <span className="font-extrabold text-slate-900">"{log.item_name}"</span>
                    </div>

                    {/* Context Sub-row */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-medium bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span>📚 Subject: <strong className="text-slate-700">{log.subject_name || "General"}</strong></span>
                      <span>•</span>
                      <span>🏫 Section: <strong className="text-slate-700">{log.section_name || "General"}</strong></span>
                      {log.previous_status && log.new_status && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            Transition:
                            <span className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-bold uppercase">{log.previous_status}</span>
                            <span>→</span>
                            <span className="px-1.5 py-0.5 bg-brand-navy text-white rounded text-[10px] font-bold uppercase">{log.new_status}</span>
                          </span>
                        </>
                      )}
                    </div>

                    {/* Reason callout if present */}
                    {log.reason && (
                      <div className="bg-amber-50 border-l-4 border-amber-400 p-2.5 rounded-r-xl">
                        <span className="text-[10px] font-black uppercase text-amber-800 block mb-0.5">
                          Reason / Feedback:
                        </span>
                        <p className="text-xs text-amber-950 italic">"{log.reason}"</p>
                      </div>
                    )}

                    {/* Details Toggle Button */}
                    <div className="flex items-center justify-end pt-1">
                      <button
                        onClick={() => setActiveDetailLog(log)}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-brand-indigo transition-colors flex items-center gap-1"
                      >
                        <span>🔍 View Details</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls Bar */}
          {filteredLogs.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200 text-xs font-semibold text-slate-600 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span>
                Showing <strong>{startIndex + 1}</strong>–<strong>{Math.min(startIndex + ITEMS_PER_PAGE, filteredLogs.length)}</strong> of <strong>{filteredLogs.length}</strong> activity records
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold transition-colors shadow-2xs"
                >
                  Previous
                </button>
                <span className="px-3.5 py-1.5 bg-slate-100 rounded-xl text-slate-800 font-extrabold">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold transition-colors shadow-2xs"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Structured Details Modal / Drawer */}
      {activeDetailLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-brand-navy text-white p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black tracking-widest text-brand-gold uppercase block mb-0.5">
                  Audit Entry Details
                </span>
                <h3 className="text-lg font-black">{getActionInfo(activeDetailLog.action).label}</h3>
              </div>
              <button
                onClick={() => setActiveDetailLog(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-base transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body: 7-Point Attribution */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="space-y-3 divide-y divide-slate-100 text-xs">
                {/* 1. Action */}
                <div className="pt-2 flex justify-between items-center">
                  <span className="font-bold text-slate-500 uppercase">Action Performed</span>
                  <span className="font-black text-slate-900">{getActionInfo(activeDetailLog.action).label}</span>
                </div>

                {/* 2. User */}
                <div className="pt-2 flex justify-between items-center">
                  <span className="font-bold text-slate-500 uppercase">User</span>
                  <span className="font-extrabold text-brand-navy">{activeDetailLog.user_full_name}</span>
                </div>

                {/* 3. Role */}
                <div className="pt-2 flex justify-between items-center">
                  <span className="font-bold text-slate-500 uppercase">Role</span>
                  <div>{getRoleBadge(activeDetailLog.user_role)}</div>
                </div>

                {/* 4. Affected Item */}
                <div className="pt-2 flex justify-between items-center">
                  <span className="font-bold text-slate-500 uppercase">Affected Item / Quiz</span>
                  <span className="font-extrabold text-slate-900">{activeDetailLog.item_name}</span>
                </div>

                {/* 5. Subject */}
                <div className="pt-2 flex justify-between items-center">
                  <span className="font-bold text-slate-500 uppercase">Subject</span>
                  <span className="font-semibold text-slate-700">{activeDetailLog.subject_name || "N/A"}</span>
                </div>

                {/* 6. Section */}
                <div className="pt-2 flex justify-between items-center">
                  <span className="font-bold text-slate-500 uppercase">Section</span>
                  <span className="font-semibold text-slate-700">{activeDetailLog.section_name || "N/A"}</span>
                </div>

                {/* 7. Date & Time */}
                <div className="pt-2 flex justify-between items-center">
                  <span className="font-bold text-slate-500 uppercase">Date & Time</span>
                  <span className="font-mono font-bold text-slate-700">
                    {formatDate(activeDetailLog.created_at)} • {formatTime(activeDetailLog.created_at)}
                  </span>
                </div>

                {/* 8. Previous Status */}
                {activeDetailLog.previous_status && (
                  <div className="pt-2 flex justify-between items-center">
                    <span className="font-bold text-slate-500 uppercase">Previous Status</span>
                    <span className="font-bold text-slate-600 uppercase">{activeDetailLog.previous_status}</span>
                  </div>
                )}

                {/* 9. New Status */}
                {activeDetailLog.new_status && (
                  <div className="pt-2 flex justify-between items-center">
                    <span className="font-bold text-slate-500 uppercase">New Status</span>
                    <span className="font-bold text-emerald-600 uppercase">{activeDetailLog.new_status}</span>
                  </div>
                )}

                {/* 10. Reason / Comment */}
                {activeDetailLog.reason && (
                  <div className="pt-2">
                    <span className="font-bold text-slate-500 uppercase block mb-1">Reason / Feedback</span>
                    <p className="p-3 bg-amber-50 rounded-xl border border-amber-200 italic text-amber-950 font-medium">
                      "{activeDetailLog.reason}"
                    </p>
                  </div>
                )}

                {/* 11. Change Details */}
                {activeDetailLog.change_summary && (
                  <div className="pt-2">
                    <span className="font-bold text-slate-500 uppercase block mb-1">Change Summary</span>
                    <p className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 font-mono text-[11px]">
                      {activeDetailLog.change_summary}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setActiveDetailLog(null)}
                className="px-5 py-2 bg-brand-navy hover:bg-brand-indigo text-white text-xs font-bold rounded-xl transition-colors"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
