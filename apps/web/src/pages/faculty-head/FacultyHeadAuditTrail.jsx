import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../../supabaseClient.js";

export const FacultyHeadAuditTrail = () => {
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState("all");
  const [filterTable, setFilterTable] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("table"); // 'table' | 'timeline'

  useEffect(() => {
    fetchAuditLogs();
  }, [filterAction, filterTable]);

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

      // Fetch profiles manually to ensure compatibility even if foreign key joins fail
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
      const quizIds = [...new Set(rawLogs.filter(l => l.table_name === 'quizzes').map((l) => l.record_id).filter(Boolean))];
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
      const detailsMatch = JSON.stringify(log.new_values || {}).toLowerCase().includes(term);
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
        return "bg-blue-100 text-blue-800 border border-blue-200";
      case "quiz_submitted":
      case "revision_submitted":
        return "bg-amber-100 text-amber-800 border border-amber-200";
      case "quiz_approved":
        return "bg-emerald-100 text-emerald-800 border border-emerald-200";
      case "revision_requested":
        return "bg-orange-100 text-orange-800 border border-orange-200";
      case "quiz_updated":
        return "bg-indigo-100 text-indigo-800 border border-indigo-200";
      case "quiz_deleted":
        return "bg-red-100 text-red-800 border border-red-200";
      case "analysis_saved":
        return "bg-purple-100 text-purple-800 border border-purple-200";
      case "user_login":
        return "bg-yellow-100 text-yellow-800 border border-yellow-200";
      default:
        return "bg-gray-100 text-gray-800 border border-gray-200";
    }
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-white shadow-lg rounded-xl overflow-hidden">
          {/* Header */}
          <div className="p-6 bg-gradient-to-r from-brand-navy to-brand-indigo text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold uppercase tracking-wider flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-brand-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Department Audit Trail
              </h1>
              <p className="opacity-80 text-sm mt-1">
                Monitor and audit the complete examination workflow, submissions, and system events
              </p>
            </div>
            <div className="flex items-center gap-2 bg-white/10 p-1.5 rounded-lg border border-white/20">
              <button
                onClick={() => setViewMode("table")}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  viewMode === "table" ? "bg-white text-brand-navy shadow" : "text-white/80 hover:text-white"
                }`}
              >
                Table View
              </button>
              <button
                onClick={() => setViewMode("timeline")}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  viewMode === "timeline" ? "bg-white text-brand-navy shadow" : "text-white/80 hover:text-white"
                }`}
              >
                Timeline View
              </button>
            </div>
          </div>
          
          {/* Filters & Search */}
          <div className="p-6 bg-gray-50 border-b border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                Search Audit Trail
              </label>
              <input
                type="text"
                placeholder="Search quiz, user, email, or details..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                Filter by Action
              </label>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm"
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
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                Filter by Table
              </label>
              <select
                value={filterTable}
                onChange={(e) => setFilterTable(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm"
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
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand-gold"></div>
              </div>
            ) : viewMode === "table" ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 text-gray-600 text-xs uppercase font-bold tracking-wider">
                    <tr>
                      <th className="p-4 text-left">Timestamp</th>
                      <th className="p-4 text-left">Action</th>
                      <th className="p-4 text-left">Table</th>
                      <th className="p-4 text-left">Quiz</th>
                      <th className="p-4 text-left">User</th>
                      <th className="p-4 text-left">Role</th>
                      <th className="p-4 text-left">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="p-4 text-gray-600 font-mono text-xs whitespace-nowrap">
                          {formatDate(log.created_at)}
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${getActionBadgeColor(log.action)}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="p-4 text-gray-700 font-medium">
                          {log.table_name || "-"}
                        </td>
                        <td className="p-4 text-gray-700">
                          {log.table_name === 'quizzes' && log.quiz ? (
                            <div>
                              <div className="font-semibold text-gray-800 text-sm">
                                {log.quiz.title || "Untitled Quiz"}
                              </div>
                              {log.quiz.status && (
                                <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-medium">
                                  {log.quiz.status}
                                </span>
                              )}
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="p-4 text-gray-700">
                          <div className="font-semibold text-gray-800">
                            {log.profiles?.first_name || log.profiles?.last_name
                              ? `${log.profiles.first_name || ""} ${log.profiles.last_name || ""}`.trim()
                              : log.profiles?.username || "Unknown User"}
                          </div>
                          {log.profiles?.email && (
                            <div className="text-xs text-gray-500 font-mono">
                              {log.profiles.email}
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-gray-700 font-medium capitalize">
                          {log.user_role || "-"}
                        </td>
                        <td className="p-4 text-gray-600 max-w-xs">
                          {log.new_values ? (
                            <details className="text-xs group">
                              <summary className="cursor-pointer font-bold text-indigo-600 hover:text-indigo-800">
                                View Event Details
                              </summary>
                              <pre className="mt-2 p-3 bg-gray-900 text-emerald-400 rounded-lg text-left overflow-auto font-mono text-[11px]">
                                {JSON.stringify(log.new_values, null, 2)}
                              </pre>
                            </details>
                          ) : "-"}
                        </td>
                      </tr>
                    ))}
                    {filteredLogs.length === 0 && (
                      <tr>
                        <td colSpan="7" className="p-12 text-center text-gray-500">
                          <div className="font-bold text-base text-gray-700 mb-1">No audit logs found</div>
                          <p className="text-xs text-gray-400">Try adjusting your search terms or filters above.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Timeline View */
              <div className="space-y-6 relative border-l-2 border-indigo-100 ml-4 pl-6 py-2">
                {filteredLogs.map((log) => (
                  <div key={log.id} className="relative group">
                    <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-indigo-600 border-4 border-white shadow" />
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${getActionBadgeColor(log.action)}`}>
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
                      <div className="text-sm font-bold text-gray-800">
                        {log.profiles?.first_name || log.profiles?.last_name
                          ? `${log.profiles.first_name || ""} ${log.profiles.last_name || ""}`.trim()
                          : log.profiles?.username || log.user_id || "System User"}
                        <span className="text-xs font-normal text-gray-500 ml-2">
                          ({log.user_role || "User"})
                        </span>
                      </div>
                      {log.new_values && (
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-xs font-mono text-gray-700 overflow-x-auto">
                          {JSON.stringify(log.new_values)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {filteredLogs.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    No timeline logs match your filters.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
