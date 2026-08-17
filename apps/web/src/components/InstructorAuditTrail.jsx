import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

export const InstructorAuditTrail = () => {
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("table"); // "table" or "timeline"

  useEffect(() => {
    fetchAuditLogs();
  }, [filterAction]);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      let query = supabase
        .from("audit_trail")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (filterAction !== "all") {
        query = query.eq("action", filterAction);
      }

      const { data: logsData, error: logsError } = await query;

      if (logsError) throw logsError;

      const rawLogs = logsData || [];

      // Fetch profiles for user information
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

      // Fetch section information for section-related audit logs
      const sectionIds = [...new Set(rawLogs.filter(l => l.table_name === 'sections').map((l) => l.record_id).filter(Boolean))];
      let sectionMap = {};

      if (sectionIds.length > 0) {
        const { data: sectionsData } = await supabase
          .from("sections")
          .select("id, name, description")
          .in("id", sectionIds);

        (sectionsData || []).forEach((s) => {
          sectionMap[s.id] = s;
        });
      }

      const enrichedLogs = rawLogs.map((log) => ({
        ...log,
        profiles: profileMap[log.user_id] || null,
        quiz: quizMap[log.record_id] || null,
        section: sectionMap[log.record_id] || null,
      }));

      setAuditLogs(enrichedLogs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      setAuditLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getActionBadgeColor = (action) => {
    const colors = {
      QUIZ_CREATED: "bg-emerald-100 text-emerald-700",
      QUIZ_UPDATED: "bg-blue-100 text-blue-700",
      QUIZ_DELETED: "bg-red-100 text-red-700",
      QUIZ_PUBLISHED: "bg-green-100 text-green-700",
      QUIZ_ARCHIVED: "bg-gray-100 text-gray-700",
      STATUS_CHANGED: "bg-amber-100 text-amber-700",
      ANALYSIS_SAVED: "bg-purple-100 text-purple-700",
      USER_LOGIN: "bg-indigo-100 text-indigo-700",
      SECTION_CREATED: "bg-teal-100 text-teal-700",
      SECTION_UPDATED: "bg-cyan-100 text-cyan-700",
      SECTION_ARCHIVED: "bg-slate-100 text-slate-700",
      QUESTIONS_CREATED: "bg-lime-100 text-lime-700",
      QUESTION_UPDATED: "bg-sky-100 text-sky-700",
      QUESTION_DELETED: "bg-rose-100 text-rose-700",
    };
    return colors[action] || "bg-gray-100 text-gray-600";
  };

  const filteredLogs = auditLogs.filter((log) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.trim().toLowerCase();
    return (
      log.action?.toLowerCase().includes(q) ||
      log.table_name?.toLowerCase().includes(q) ||
      log.profiles?.first_name?.toLowerCase().includes(q) ||
      log.profiles?.last_name?.toLowerCase().includes(q) ||
      log.quiz?.title?.toLowerCase().includes(q)
    );
  });

  const uniqueActions = [...new Set(auditLogs.map((l) => l.action))];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Your Activity Log</h2>
            <p className="text-sm text-gray-500 mt-1">
              Track all your actions and changes
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold w-64"
              />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
            >
              <option value="all">All Actions</option>
              {uniqueActions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>

            <div className="flex border border-gray-300 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("table")}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  viewMode === "table"
                    ? "bg-brand-navy text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                Table
              </button>
              <button
                onClick={() => setViewMode("timeline")}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  viewMode === "timeline"
                    ? "bg-brand-navy text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                Timeline
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-gold"></div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="font-bold text-base text-gray-700 mb-1">No activity logs found</div>
            <p className="text-xs text-gray-400">Try adjusting your search terms or filters above.</p>
          </div>
        ) : viewMode === "table" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-gray-600 text-xs uppercase font-bold tracking-wider">
                <tr>
                  <th className="p-4 text-left">Timestamp</th>
                  <th className="p-4 text-left">Action</th>
                  <th className="p-4 text-left">Table</th>
                  <th className="p-4 text-left">Related Item</th>
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
                      ) : log.table_name === 'sections' && log.section ? (
                        <div>
                          <div className="font-semibold text-gray-800 text-sm">
                            {log.section.name || "Untitled Section"}
                          </div>
                          {log.section.description && (
                            <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-medium">
                              {log.section.description}
                            </span>
                          )}
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="p-4 text-gray-600 max-w-xs">
                      {log.new_values ? (
                        <details className="text-xs group">
                          <summary className="cursor-pointer font-bold text-indigo-600 hover:text-indigo-800">
                            View Details
                          </summary>
                          <pre className="mt-2 p-3 bg-gray-900 text-emerald-400 rounded-lg text-left overflow-auto font-mono text-[11px]">
                            {JSON.stringify(log.new_values, null, 2)}
                          </pre>
                        </details>
                      ) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Timeline View */
          <div className="space-y-6">
            {filteredLogs.map((log, index) => (
              <div key={log.id} className="relative pl-8 pb-6">
                {index !== filteredLogs.length - 1 && (
                  <div className="absolute left-3 top-8 bottom-0 w-0.5 bg-gray-200"></div>
                )}
                <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-brand-navy border-4 border-white shadow"></div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${getActionBadgeColor(log.action)}`}>
                        {log.action}
                      </span>
                      <span className="text-xs text-gray-500">
                        {log.table_name || "General"}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400 font-mono whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </span>
                  </div>
                  
                  {log.table_name === 'quizzes' && log.quiz && (
                    <div className="mb-2">
                      <span className="text-sm font-semibold text-gray-800">
                        {log.quiz.title || "Untitled Quiz"}
                      </span>
                      {log.quiz.status && (
                        <span className="ml-2 inline-block px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-medium">
                          {log.quiz.status}
                        </span>
                      )}
                    </div>
                  )}
                  
                  {log.table_name === 'sections' && log.section && (
                    <div className="mb-2">
                      <span className="text-sm font-semibold text-gray-800">
                        {log.section.name || "Untitled Section"}
                      </span>
                      {log.section.description && (
                        <span className="ml-2 inline-block px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-medium">
                          {log.section.description}
                        </span>
                      )}
                    </div>
                  )}
                  
                  {log.new_values && (
                    <details className="text-xs group">
                      <summary className="cursor-pointer font-bold text-indigo-600 hover:text-indigo-800">
                        View Details
                      </summary>
                      <pre className="mt-2 p-3 bg-gray-900 text-emerald-400 rounded-lg text-left overflow-auto font-mono text-[11px]">
                        {JSON.stringify(log.new_values, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
