import { Fragment, useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "../../supabaseClient.js";
import { notify } from "../../utils/notify.jsx";
import { Skeleton, SkeletonTableRow } from "../../components/ui/Skeleton.jsx";
import {
  AUDIT_ACTION_OPTIONS,
  AUDIT_TABLE_OPTIONS,
  formatAuditAction,
  formatAuditRole,
  formatAuditStatus,
  formatAuditTable,
  getAuditStatusTone,
  getReadableFields,
  getChangedFields,
  getReferencedUserIds,
  getAuditSubmissionId,
  getAuditStatus,
  getAuditFeedback,
  getAuditItemName,
  getActionBadgeColor,
} from "../../utils/auditFormat.js";

// Newest records loaded per query; narrow the date range to see older ones.
const FETCH_LIMIT = 1000;
const ITEMS_PER_PAGE = 10;

const fullName = (p) =>
  p ? `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.username || p.email || null : null;

const formatDate = (dateString) =>
  new Date(dateString).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const ContextCell = ({ log }) => {
  const item = getAuditItemName(log);
  // Section rows use the section as the item, so don't repeat it underneath
  const context = [log.subject_name, log.section_name]
    .filter((v) => v && v !== item)
    .join(" · ");
  if (!item && !context) return <span className="text-gray-400">—</span>;
  return (
    <div className="min-w-0">
      {item && <div className="font-bold text-brand-navy text-xs truncate max-w-[220px]">{item}</div>}
      {context && <div className="text-[10px] text-gray-500 truncate max-w-[220px]">{context}</div>}
    </div>
  );
};

const ActorCell = ({ log }) => (
  <div>
    <div className="font-bold text-gray-900">{fullName(log.profiles) || "Unknown User"}</div>
    <div className="text-[10px] text-gray-500">{formatAuditRole(log.user_role)}</div>
  </div>
);

/** Readable details for one audit record (replaces the raw JSON dump). */
// Senior Faculty open submissions in Exam Reviews, Department Heads in Quiz Approvals
const useSubmissionBasePath = () =>
  useLocation().pathname.startsWith("/admin-dashboard")
    ? "/admin-dashboard/quiz-reviews"
    : "/faculty-head-dashboard/quiz-approvals";

const EventDetails = ({ log }) => {
  const [showRaw, setShowRaw] = useState(false);
  const submissionBasePath = useSubmissionBasePath();
  const status = getAuditStatus(log);
  const feedback = getAuditFeedback(log);
  const submissionId = getAuditSubmissionId(log);
  const extraFields = getReadableFields(log.new_values);
  const changes = getChangedFields(log.old_values, log.new_values);

  const rows = [
    { label: "Item", value: getAuditItemName(log) },
    { label: "Subject", value: log.subject_name },
    { label: "Section", value: log.section_name },
    { label: "Instructor", value: log.instructorName },
    ...extraFields.map((f) => ({ label: f.label, value: f.value })),
  ].filter((r) => r.value && r.value !== "—");

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
      {(status || log.previous_status) && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-gray-500 uppercase tracking-wider text-[10px] w-24 shrink-0">
            Status
          </span>
          {log.previous_status && (
            <>
              <span className={`px-2 py-0.5 rounded-full border font-semibold ${getAuditStatusTone(log.previous_status)}`}>
                {formatAuditStatus(log.previous_status)}
              </span>
              <span className="text-gray-400" aria-hidden="true">→</span>
            </>
          )}
          {status && (
            <span className={`px-2 py-0.5 rounded-full border font-bold ${getAuditStatusTone(status)}`}>
              {formatAuditStatus(status)}
            </span>
          )}
        </div>
      )}

      {rows.length > 0 && (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
          {rows.map((r) => (
            <div key={r.label} className="flex gap-2 min-w-0">
              <dt className="font-bold text-gray-500 uppercase tracking-wider text-[10px] w-24 shrink-0 pt-0.5">
                {r.label}
              </dt>
              <dd className="text-gray-800 font-medium break-words min-w-0">{r.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {feedback && (
        <div>
          <p className="font-bold text-gray-500 uppercase tracking-wider text-[10px] mb-1">
            Reason / Feedback
          </p>
          <p className="text-gray-800 whitespace-pre-wrap bg-white border border-slate-200 rounded-lg p-2.5">
            {feedback}
          </p>
        </div>
      )}

      {log.change_summary && (
        <p className="text-gray-700">
          <span className="font-bold text-gray-500 uppercase tracking-wider text-[10px] mr-2">Summary</span>
          {log.change_summary}
        </p>
      )}

      {changes.length > 0 && (
        <div>
          <p className="font-bold text-gray-500 uppercase tracking-wider text-[10px] mb-1">Changes</p>
          <ul className="space-y-1">
            {changes.map((c) => (
              <li key={c.key} className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-gray-600">{c.label}:</span>
                <span className="line-through text-rose-600/80 break-words">{c.before}</span>
                <span className="text-gray-400" aria-hidden="true">→</span>
                <span className="text-emerald-700 font-semibold break-words">{c.after}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        {submissionId && (
          <Link
            to={`${submissionBasePath}/${submissionId}`}
            className="inline-flex items-center gap-1 font-bold text-brand-navy hover:text-brand-indigo hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
          >
            Open submission
            <span aria-hidden="true">→</span>
          </Link>
        )}
        {(log.new_values || log.old_values) && (
          <button
            type="button"
            onClick={() => setShowRaw((v) => !v)}
            aria-expanded={showRaw}
            className="text-[11px] text-gray-400 hover:text-gray-600 underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
          >
            {showRaw ? "Hide technical details" : "Technical details"}
          </button>
        )}
      </div>

      {showRaw && (
        <pre className="p-3 bg-white border border-slate-200 text-slate-600 rounded-lg overflow-auto font-mono text-[10px] whitespace-pre-wrap break-all max-h-60">
          {JSON.stringify({ record_id: log.record_id, old_values: log.old_values, new_values: log.new_values }, null, 2)}
        </pre>
      )}
    </div>
  );
};

export const FacultyHeadAuditTrail = () => {
  // Shared by the Department Head and Senior Faculty portals
  const isSeniorFaculty = useLocation().pathname.startsWith("/admin-dashboard");
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hitLimit, setHitLimit] = useState(false);
  const [filterAction, setFilterAction] = useState("all");
  const [filterTable, setFilterTable] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("table"); // 'table' | 'timeline'
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    fetchAuditLogs();
  }, [filterAction, filterTable, dateFrom, dateTo]);

  // Reset pagination when search, filter, or viewMode changes
  useEffect(() => {
    setCurrentPage(1);
    setExpandedId(null);
  }, [searchTerm, filterAction, filterTable, dateFrom, dateTo, viewMode]);

  // Only the first load shows the skeleton so changing a filter doesn't
  // unmount the filter bar mid-interaction.
  const fetchAuditLogs = async () => {
    try {
      setRefreshing(true);
      let query = supabase
        .from("audit_trail")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(FETCH_LIMIT);

      if (filterAction !== "all") query = query.eq("action", filterAction);
      if (filterTable !== "all") query = query.eq("table_name", filterTable);
      if (dateFrom) query = query.gte("created_at", new Date(`${dateFrom}T00:00:00`).toISOString());
      if (dateTo) query = query.lte("created_at", new Date(`${dateTo}T23:59:59.999`).toISOString());

      const { data: logsData, error: logsError } = await query;
      if (logsError) throw logsError;

      const rawLogs = logsData || [];
      setHitLimit(rawLogs.length >= FETCH_LIMIT);

      // Resolve actors and any instructors referenced in the payload
      const userIds = [
        ...new Set(rawLogs.flatMap((l) => [l.user_id, ...getReferencedUserIds(l)]).filter(Boolean)),
      ];
      const quizIds = [
        ...new Set(
          rawLogs.filter((l) => l.table_name === "quizzes").map((l) => l.record_id).filter(Boolean),
        ),
      ];

      const [profilesRes, quizzesRes] = await Promise.all([
        userIds.length
          ? supabase
              .from("profiles")
              .select("id, username, email, first_name, last_name")
              .in("id", userIds)
          : Promise.resolve({ data: [] }),
        quizIds.length
          ? supabase.from("quizzes").select("id, title, status").in("id", quizIds)
          : Promise.resolve({ data: [] }),
      ]);

      const profileMap = new Map((profilesRes.data || []).map((p) => [p.id, p]));
      const quizMap = new Map((quizzesRes.data || []).map((q) => [q.id, q]));

      setAuditLogs(
        rawLogs.map((log) => {
          const instructorId = getReferencedUserIds(log)[0];
          return {
            ...log,
            profiles: profileMap.get(log.user_id) || null,
            quiz: log.table_name === "quizzes" ? quizMap.get(log.record_id) || null : null,
            instructorName: instructorId ? fullName(profileMap.get(instructorId)) : null,
          };
        }),
      );
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      notify.error("Failed to load audit logs.");
      setAuditLogs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filteredLogs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return auditLogs;
    // Search what people can see — not IDs buried in the raw payload
    return auditLogs.filter((log) =>
      [
        formatAuditAction(log.action),
        formatAuditTable(log.table_name),
        formatAuditRole(log.user_role),
        fullName(log.profiles),
        log.profiles?.email,
        getAuditItemName(log),
        log.subject_name,
        log.section_name,
        log.instructorName,
        getAuditFeedback(log),
        log.change_summary,
        getAuditStatus(log) && formatAuditStatus(getAuditStatus(log)),
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term)),
    );
  }, [auditLogs, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedLogs = filteredLogs.slice(startIndex, endIndex);
  const hasActiveFilters =
    filterAction !== "all" || filterTable !== "all" || dateFrom || dateTo || searchTerm;

  const clearFilters = () => {
    setFilterAction("all");
    setFilterTable("all");
    setDateFrom("");
    setDateTo("");
    setSearchTerm("");
  };

  const exportCsv = () => {
    if (filteredLogs.length === 0) return;
    const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = [
      "Timestamp",
      "Action",
      "Area",
      "Item",
      "Subject",
      "Section",
      "Instructor",
      "Previous Status",
      "New Status",
      "Reason / Feedback",
      "Performed By",
      "Email",
      "Role",
    ];
    const rows = filteredLogs.map((log) => [
      new Date(log.created_at).toLocaleString("en-US"),
      formatAuditAction(log.action),
      formatAuditTable(log.table_name),
      getAuditItemName(log),
      log.subject_name,
      log.section_name,
      log.instructorName,
      log.previous_status ? formatAuditStatus(log.previous_status) : "",
      getAuditStatus(log) ? formatAuditStatus(getAuditStatus(log)) : "",
      getAuditFeedback(log),
      fullName(log.profiles) || "Unknown User",
      log.profiles?.email,
      formatAuditRole(log.user_role),
    ]);
    const csv = [header, ...rows].map((r) => r.map(escape).join(",")).join("\r\n");
    // Byte-order mark so Excel opens the UTF-8 CSV with names intact
    const BOM = String.fromCharCode(0xfeff);
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-auto bg-authentic-white" aria-label="Loading audit trail">
        <div className="bg-gradient-to-r from-brand-navy to-brand-indigo px-6 py-8">
          <Skeleton tone="bg-white/20" className="h-4 w-36 rounded-md mb-2" />
          <Skeleton tone="bg-white/20" className="h-8 w-72 max-w-full rounded-md mb-2" />
          <Skeleton tone="bg-white/20" className="h-4 w-96 max-w-full rounded-md" />
        </div>
        <div className="p-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            <SkeletonTableRow cells={5} />
            <SkeletonTableRow cells={5} />
            <SkeletonTableRow cells={5} />
            <SkeletonTableRow cells={5} />
          </div>
        </div>
      </div>
    );
  }

  const fieldLabel = "block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5";
  const fieldInput =
    "w-full px-3.5 py-2 border border-slate-200 rounded-lg text-xs text-brand-navy bg-white shadow-2xs focus:outline-none focus:ring-2 focus:ring-brand-gold/20 focus:border-brand-gold transition-all";

  return (
    <>
      {/* Hero Header Banner */}
      <div className="bg-gradient-to-r from-brand-navy to-brand-indigo px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-brand-gold text-sm font-semibold uppercase tracking-widest mb-1">
              {isSeniorFaculty ? "Senior Faculty" : "Department Head"}
            </p>
            <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
              Audit Trail
            </h1>
            <p className="text-white/60 text-sm mt-1">
              Monitor and audit the complete examination workflow, faculty submissions, and system events.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={exportCsv}
              disabled={filteredLogs.length === 0}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70"
            >
              Export CSV
            </button>
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1.5 bg-white/10 p-1.5 rounded-xl border border-white/20 backdrop-blur-xs" role="tablist" aria-label="Audit trail view">
              {[
                { key: "table", label: "Table View" },
                { key: "timeline", label: "Timeline View" },
              ].map((v) => (
                <button
                  key={v.key}
                  role="tab"
                  aria-selected={viewMode === v.key}
                  onClick={() => setViewMode(v.key)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70 ${
                    viewMode === v.key ? "bg-brand-gold text-brand-navy shadow-xs" : "text-white/80 hover:text-white"
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          {/* Filters & Search Bar */}
          <div className="p-5 bg-slate-50/60 border-b border-gray-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <label htmlFor="audit-search" className={fieldLabel}>
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
                  id="audit-search"
                  type="text"
                  placeholder="Search exam, person, action, feedback..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`${fieldInput} pl-10 pr-10`}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    aria-label="Clear search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold text-sm rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="audit-action" className={fieldLabel}>
                Action
              </label>
              <select
                id="audit-action"
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className={fieldInput}
              >
                <option value="all">All Actions</option>
                {AUDIT_ACTION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="audit-table" className={fieldLabel}>
                Area
              </label>
              <select
                id="audit-table"
                value={filterTable}
                onChange={(e) => setFilterTable(e.target.value)}
                className={fieldInput}
              >
                <option value="all">All Areas</option>
                {AUDIT_TABLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className={fieldLabel}>Date Range</span>
              <div className="flex items-center gap-1.5">
                <label htmlFor="audit-date-from" className="sr-only">From date</label>
                <input
                  id="audit-date-from"
                  type="date"
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className={`${fieldInput} px-2`}
                />
                <span className="text-gray-400 text-xs" aria-hidden="true">–</span>
                <label htmlFor="audit-date-to" className="sr-only">To date</label>
                <input
                  id="audit-date-to"
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(e) => setDateTo(e.target.value)}
                  className={`${fieldInput} px-2`}
                />
              </div>
            </div>
          </div>

          {/* Result summary */}
          <div className="px-5 py-2.5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500">
            <span className="flex items-center gap-2">
              {refreshing && (
                <span className="h-3 w-3 rounded-full border-2 border-slate-300 border-t-brand-navy animate-spin" aria-hidden="true" />
              )}
              <strong className="text-gray-700">{filteredLogs.length}</strong> record
              {filteredLogs.length === 1 ? "" : "s"}
              {hitLimit && (
                <span className="text-amber-700">
                  · showing the latest {FETCH_LIMIT.toLocaleString()} — narrow the date range to see older records
                </span>
              )}
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="font-bold text-brand-navy hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Main Content */}
          <div className="p-0">
            {viewMode === "table" ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-bold tracking-wider border-b border-gray-200 text-[11px]">
                    <tr>
                      <th className="px-5 py-3.5 text-left">Timestamp</th>
                      <th className="px-5 py-3.5 text-left">Action</th>
                      <th className="px-5 py-3.5 text-left">Exam / Context</th>
                      <th className="px-5 py-3.5 text-left">Performed By</th>
                      <th className="px-5 py-3.5 text-left">Area</th>
                      <th className="px-5 py-3.5 text-right">
                        <span className="sr-only">Details</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedLogs.map((log) => {
                      const expanded = expandedId === log.id;
                      return (
                        <Fragment key={log.id}>
                          <tr className={`transition-colors ${expanded ? "bg-slate-50/80" : "hover:bg-slate-50/70"}`}>
                            <td className="px-5 py-3.5 text-gray-600 font-mono text-[11px] whitespace-nowrap">
                              {formatDate(log.created_at)}
                            </td>
                            <td className="px-5 py-3.5">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${getActionBadgeColor(log.action)}`}>
                                {formatAuditAction(log.action)}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-gray-700">
                              <ContextCell log={log} />
                            </td>
                            <td className="px-5 py-3.5 text-gray-700">
                              <ActorCell log={log} />
                            </td>
                            <td className="px-5 py-3.5 text-gray-600 font-medium whitespace-nowrap">
                              {formatAuditTable(log.table_name)}
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <button
                                type="button"
                                onClick={() => setExpandedId(expanded ? null : log.id)}
                                aria-expanded={expanded}
                                aria-controls={`audit-details-${log.id}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-brand-navy hover:bg-brand-navy/5 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
                              >
                                {expanded ? "Hide" : "Details"}
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2.5}
                                  aria-hidden="true"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                          {expanded && (
                            <tr id={`audit-details-${log.id}`} className="bg-slate-50/80">
                              <td colSpan={6} className="px-5 pb-4 pt-0">
                                <EventDetails log={log} />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                    {filteredLogs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-12 text-center text-gray-400">
                          <div className="font-bold text-sm text-gray-700 mb-1">No audit logs found</div>
                          <p className="text-xs text-gray-400">Try adjusting your search terms or filters above.</p>
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
                      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs hover:shadow-xs transition-all space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${getActionBadgeColor(log.action)}`}>
                              {formatAuditAction(log.action)}
                            </span>
                            <span className="text-xs font-semibold text-gray-500">
                              {formatAuditTable(log.table_name)}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400 font-mono">{formatDate(log.created_at)}</span>
                        </div>
                        <div className="text-sm font-bold text-gray-900">
                          {fullName(log.profiles) || "Unknown User"}
                          <span className="text-xs font-normal text-gray-500 ml-2">
                            ({formatAuditRole(log.user_role)})
                          </span>
                        </div>
                        <EventDetails log={log} />
                      </div>
                    </div>
                  ))}
                  {filteredLogs.length === 0 && (
                    <div className="text-center py-12 text-gray-400 text-xs">No timeline logs match your filters.</div>
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
                      aria-label="Previous page"
                      className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold transition-colors shadow-2xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
                    >
                      Previous
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                      if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                        return (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            aria-label={`Go to page ${page}`}
                            aria-current={currentPage === page ? "page" : undefined}
                            className={`w-8 h-8 rounded-lg font-bold text-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 ${
                              currentPage === page ? "bg-brand-navy text-white shadow-xs" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
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
                      aria-label="Next page"
                      className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold transition-colors shadow-2xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
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

