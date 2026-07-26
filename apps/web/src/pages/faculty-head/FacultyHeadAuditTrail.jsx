import React, { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient.js";

export const FacultyHeadAuditTrail = () => {
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState("all");
  const [filterTable, setFilterTable] = useState("all");

  useEffect(() => {
    fetchAuditLogs();
  }, [filterAction, filterTable]);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("audit_trail")
        .select(`
          *,
          profiles!audit_trail_user_id_fkey (
            username, email
          )
        `)
        .order("created_at", { ascending: false });

      if (filterAction !== "all") {
        query = query.eq("action", filterAction);
      }

      if (filterTable !== "all") {
        query = query.eq("table_name", filterTable);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAuditLogs(data || []);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getActionBadgeColor = (action) => {
    switch (action?.toLowerCase()) {
      case "quiz_created":
        return "bg-green-100 text-green-800";
      case "quiz_updated":
        return "bg-blue-100 text-blue-800";
      case "quiz_deleted":
        return "bg-red-100 text-red-800";
      case "analysis_saved":
        return "bg-purple-100 text-purple-800";
      case "user_login":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-white shadow-lg rounded-xl overflow-hidden">
          <div className="p-6 bg-brand-navy text-white">
            <h1 className="text-2xl font-bold uppercase tracking-wider">
              Audit Trail
            </h1>
            <p className="opacity-80 text-sm">
              Monitor all system activities and changes
            </p>
          </div>
          
          <div className="p-6 bg-gray-50 border-b border-gray-200 flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Filter by Action
              </label>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="all">All Actions</option>
                <option value="QUIZ_CREATED">Quiz Created</option>
                <option value="QUIZ_UPDATED">Quiz Updated</option>
                <option value="QUIZ_DELETED">Quiz Deleted</option>
                <option value="ANALYSIS_SAVED">Analysis Saved</option>
                <option value="USER_LOGIN">User Login</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Filter by Table
              </label>
              <select
                value={filterTable}
                onChange={(e) => setFilterTable(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="all">All Tables</option>
                <option value="quizzes">Quizzes</option>
                <option value="questions">Questions</option>
                <option value="profiles">Profiles</option>
              </select>
            </div>
          </div>
          
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand-gold"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 text-gray-600 text-xs uppercase">
                    <tr>
                      <th className="p-4 text-left">Timestamp</th>
                      <th className="p-4 text-left">Action</th>
                      <th className="p-4 text-left">Table</th>
                      <th className="p-4 text-left">User</th>
                      <th className="p-4 text-left">Role</th>
                      <th className="p-4 text-left">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="p-4 text-gray-600 font-mono">
                          {formatDate(log.created_at)}
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getActionBadgeColor(log.action)}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="p-4 text-gray-700">
                          {log.table_name || "-"}
                        </td>
                        <td className="p-4 text-gray-700">
                          {log.profiles?.username || "Unknown"}
                          {log.profiles?.email && (
                            <div className="text-xs text-gray-500">
                              {log.profiles.email}
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-gray-700">
                          {log.user_role || "-"}
                        </td>
                        <td className="p-4 text-gray-600 max-w-xs truncate">
                          {log.new_values ? (
                            <details className="text-xs">
                              <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                                View Details
                              </summary>
                              <pre className="mt-2 p-2 bg-gray-100 rounded text-left overflow-auto">
                                {JSON.stringify(log.new_values, null, 2)}
                              </pre>
                            </details>
                          ) : "-"}
                        </td>
                      </tr>
                    ))}
                    {auditLogs.length === 0 && (
                      <tr>
                        <td colSpan="6" className="p-8 text-center text-gray-500">
                          No audit logs found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
