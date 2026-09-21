import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../../supabaseClient.js";

export const FacultyHeadAuditTrail = () => {
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState("all");
  const [filterTable, setFilterTable] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("table"); // 'table' | 'timeline'
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    fetchAuditLogs();
  }, [filterAction, filterTable]);

  // Reset pagination when search, filter, or viewMode changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterAction, filterTable, viewMode]);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("audit_trail")
        .select("*")
        .order("created_at", { ascending: false });

      if (filterAction !== "all") {
        query = query.eq("action", filterAction);
      }

      if (filterTable !== "all") {
        query = query.eq("table_name", filterTable);
      }

      const { data: logsData, error: logsError } = await query;

      if (logsError) throw logsError;

      const rawLogs = logsData || [];

      // Fetch profiles manually to ensure compatibility
      const userIds = [...new Set(rawLogs.map((l) => l.user_id).filter(Boolean))];
      let profileMap = {};

      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, username, email, first_name, last_name")
          .in("id", userIds);

        (profilesData || []).forEach((p) => {
          profileMap[p.id] = p;
        });
      }

      // Fetch quiz information for quiz-related audit logs
      const quizIds = [
        ...new Set(
          rawLogs
            .filter((l) => l.table_name === "quizzes")
            .map((l) => l.record_id)
            .filter(Boolean)
        ),
      ];
      let quizMap = {};

      if (quizIds.length > 0) {
        const { data: quizzesData } = await supabase
          .from("quizzes")
          .select("id, title, status")
          .in("id", quizIds);

        (quizzesData || []).forEach((q) => {
          quizMap[q.id] = q;
        });
      }

      const enrichedLogs = rawLogs.map((log) => ({
        ...log,
        profiles: profileMap[log.user_id] || null,
        quiz: quizMap[log.record_id] || null,
      }));

      setAuditLogs(enrichedLogs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      setAuditLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = useMemo(() => {
    if (!searchTerm.trim()) return auditLogs;
    const term = searchTerm.toLowerCase();
    return auditLogs.filter((log) => {
      const actionMatch = (log.action || "").toLowerCase().includes(term);
      const tableMatch = (log.table_name || "").toLowerCase().includes(term);
      const userMatch =
        (log.profiles?.username || "").toLowerCase().includes(term) ||
        (log.profiles?.email || "").toLowerCase().includes(term) ||
        (log.profiles?.first_name || "").toLowerCase().includes(term) ||
        (log.profiles?.last_name || "").toLowerCase().includes(term);
      const detailsMatch = JSON.stringify(log.new_values || {})
        .toLowerCase()
        .includes(term);
      return actionMatch || tableMatch || userMatch || detailsMatch;
    });
  }, [auditLogs, searchTerm]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getActionBadgeColor = (action) => {
    switch (action?.toLowerCase()) {
      case "quiz_created":
        return "bg-blue-50 text-blue-800 border border-blue-200/80";
      case "quiz_submitted":
      case "revision_submitted":
        return "bg-amber-50 text-amber-800 border border-amber-200/80";
      case "quiz_approved":
        return "bg-emerald-50 text-emerald-800 border border-emerald-200/80";
      case "revision_requested":
        return "bg-orange-50 text-orange-800 border border-orange-200/80";
      case "quiz_updated":
        return "bg-indigo-50 text-indigo-800 border border-indigo-200/80";
      case "quiz_deleted":
        return "bg-rose-50 text-rose-800 border border-rose-200/80";
      case "analysis_saved":
        return "bg-purple-50 text-purple-800 border border-purple-200/80";
      case "user_login":
        return "bg-slate-100 text-slate-700 border border-slate-200";
      default:
        return "bg-gray-100 text-gray-700 border border-gray-200";
    }
  };

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

  return (
    <>
      {/* Hero Header Banner consistent with Department Head navigation */}
      <div className="bg-gradient-to-r from-brand-navy to-brand-indigo px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-brand-gold text-sm font-semibold uppercase tracking-widest mb-1">
              Department Head
            </p>
            <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
              Department Audit Trail
            </h1>
            <p className="text-white/60 text-sm mt-1">
              Monitor and audit the complete examination workflow, faculty submissions, and system events.
            </p>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1.5 bg-white/10 p-1.5 rounded-xl border border-white/20 self-start sm:self-auto backdrop-blur-xs">
            <button
              onClick={() => setViewMode("table")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "table"
                  ? "bg-brand-gold text-brand-navy shadow-xs"
                  : "text-white/80 hover:text-white"
              }`}
            >
              Table View
            </button>
            <button
              onClick={() => setViewMode("timeline")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "timeline"
                  ? "bg-brand-gold text-brand-navy shadow-xs"
                  : "text-white/80 hover:text-white"
              }`}
            >
              Timeline View
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          {/* Filters & Search Bar */}
          <div className="p-5 bg-slate-50/60 border-b border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                Search Audit Trail
              </label>
              <div className="relative">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search quiz, user, action, details..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-gold/50 text-xs shadow-2xs"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold text-sm"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                Filter by Action
              </label>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-gold/50 bg-white text-xs shadow-2xs"
              >
                <option value="all">All Actions</option>
                <option value="QUIZ_APPROVED">Quiz Approved</option>
                <option value="QUIZ_SUBMITTED">Quiz Submitted</option>
                <option value="REVISION_REQUESTED">Revision Requested</option>
                <option value="REVISION_SUBMITTED">Revision Submitted</option>
                <option value="QUIZ_CREATED">Quiz Created</option>
                <option value="QUIZ_UPDATED">Quiz Updated</option>
                <option value="QUIZ_DELETED">Quiz Deleted</option>
                <option value="ANALYSIS_SAVED">Analysis Saved</option>
                <option value="USER_LOGIN">User Login</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                Filter by Table
              </label>
              <select
                value={filterTable}
                onChange={(e) => setFilterTable(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-gold/50 bg-white text-xs shadow-2xs"
              >
                <option value="all">All Tables</option>
                <option value="quizzes">Quizzes</option>
                <option value="quiz_analysis_submissions">Submissions</option>
                <option value="questions">Questions</option>
                <option value="profiles">Profiles</option>
              </select>
            </div>
          </div>

          {/* Main Content */}
          <div className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-navy mb-3"></div>
                <p className="text-xs text-gray-400 font-semibold">Loading audit logs...</p>
              </div>
            ) : viewMode === "table" ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-bold tracking-wider border-b border-gray-200 text-[11px]">
                    <tr>
                      <th className="px-5 py-3.5 text-left">Timestamp</th>
                      <th className="px-5 py-3.5 text-left">Action</th>
                      <th className="px-5 py-3.5 text-left">Table</th>
                      <th className="px-5 py-3.5 text-left">Quiz / Context</th>
                      <th className="px-5 py-3.5 text-left">User</th>
                      <th className="px-5 py-3.5 text-left">Role</th>
                      <th className="px-5 py-3.5 text-left">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3.5 text-gray-600 font-mono text-[11px] whitespace-nowrap">
                          {formatDate(log.created_at)}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${getActionBadgeColor(
                              log.action
                            )}`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-gray-700 font-semibold">
                          {log.table_name || "-"}
                        </td>
                        <td className="px-5 py-3.5 text-gray-700">
                          {log.table_name === "quizzes" && log.quiz ? (
                            <div>
                              <div className="font-bold text-brand-navy text-xs">
                                {log.quiz.title || "Untitled Quiz"}
                              </div>
                              {log.quiz.status && (
                                <span className="inline-block mt-0.5 px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-semibold">
                                  {log.quiz.status}
                                </span>
                              )}
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-gray-700">
                          <div className="font-bold text-gray-900">
                            {log.profiles?.first_name || log.profiles?.last_name
                              ? `${log.profiles.first_name || ""} ${log.profiles.last_name || ""}`.trim()
                              : log.profiles?.username || "Unknown User"}
                          </div>
                          {log.profiles?.email && (
                            <div className="text-[10px] text-gray-400 font-mono">
                              {log.profiles.email}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-gray-700 font-medium capitalize">
                          {log.user_role || "-"}
                        </td>
                        <td className="px-5 py-3.5 text-gray-600 max-w-xs">
                          {log.new_values ? (
                            <details className="text-xs group">
                              <summary className="cursor-pointer font-bold text-brand-navy hover:text-brand-indigo hover:underline">
                                View Event Details
                              </summary>
                              <pre className="mt-2 p-3 bg-brand-navy text-emerald-400 rounded-xl text-left overflow-auto font-mono text-[10px]">
                                {JSON.stringify(log.new_values, null, 2)}
                              </pre>
                            </details>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredLogs.length === 0 && (
                      <tr>
                        <td colSpan="7" className="p-12 text-center text-gray-400">
                          <div className="font-bold text-sm text-gray-700 mb-1">
                            No audit logs found
                          </div>
                          <p className="text-xs text-gray-400">
                            Try adjusting your search terms or filters above.
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Timeline View */
              <div className="p-6">
                <div className="space-y-6 relative border-l-2 border-slate-200 ml-4 pl-6 py-2">
                  {paginatedLogs.map((log) => (
                    <div key={log.id} className="relative group">
                      <div className="absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full bg-brand-gold border-2 border-brand-navy shadow-xs" />
                      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs hover:shadow-xs transition-all space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${getActionBadgeColor(
                                log.action
                              )}`}
                            >
                              {log.action}
                            </span>
                            <span className="text-xs font-semibold text-gray-500 font-mono">
                              {log.table_name ? `[${log.table_name}]` : ""}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400 font-mono">
                            {formatDate(log.created_at)}
                          </span>
                        </div>
                        <div className="text-sm font-bold text-gray-900">
                          {log.profiles?.first_name || log.profiles?.last_name
                            ? `${log.profiles.first_name || ""} ${log.profiles.last_name || ""}`.trim()
                            : log.profiles?.username || log.user_id || "System User"}
                          <span className="text-xs font-normal text-gray-500 ml-2 capitalize">
                            ({log.user_role || "User"})
                          </span>
                        </div>
                        {log.new_values && (
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-mono text-gray-700 overflow-x-auto">
                            {JSON.stringify(log.new_values)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {filteredLogs.length === 0 && (
                    <div className="text-center py-12 text-gray-400 text-xs">
                      No timeline logs match your filters.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Pagination Controls Bar */}
            {filteredLogs.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-gray-200 text-xs font-semibold text-gray-600 bg-white">
                <span>
                  Showing <strong>{startIndex + 1}</strong>–
                  <strong>{Math.min(endIndex, filteredLogs.length)}</strong> of{" "}
                  <strong>{filteredLogs.length}</strong> audit records
                </span>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold transition-colors shadow-2xs cursor-pointer"
                    >
                      Previous
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                      if (
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1)
                      ) {
                        return (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`w-8 h-8 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                              currentPage === page
                                ? "bg-brand-navy text-white shadow-xs"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                          >
                            {page}
                          </button>
                        );
                      } else if (page === currentPage - 2 || page === currentPage + 2) {
                        return (
                          <span key={page} className="px-1 text-gray-400">
                            ...
                          </span>
                        );
                      }
                      return null;
                    })}
                    <button
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold transition-colors shadow-2xs cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
