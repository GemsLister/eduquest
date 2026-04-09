import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";

export const AdminQuizReviews = () => {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [allSubmissions, setAllSubmissions] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    loadSubmissions();
  }, []);

  const loadSubmissions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("quiz_analysis_submissions")
        .select("*, quizzes(*)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const instructorIds = [...new Set(data.map((s) => s.instructor_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email, username")
          .in("id", instructorIds);

        const profileMap = {};
        profiles?.forEach((p) => {
          profileMap[p.id] = p;
        });

        const enrichedData = data.map((s) => ({
          ...s,
          profiles: profileMap[s.instructor_id] || null,
        }));

        // Build set of superseded submission IDs
        // (submissions that have a newer revision pointing to them)
        const supersededIds = new Set();
        enrichedData.forEach((s) => {
          if (s.previous_submission_id) {
            supersededIds.add(s.previous_submission_id);
          }
        });

        // Filter out superseded submissions only if they are still pending
        // Keep reviewed submissions (revision_requested, approved) visible
        const visibleData = enrichedData.filter(
          (s) =>
            !supersededIds.has(s.id) ||
            s.status === "revision_requested" ||
            s.status === "approved" ||
            s.status === "faculty_head_approved",
        );

        setAllSubmissions(visibleData);
      } else {
        setAllSubmissions(data || []);
      }
    } catch (err) {
      console.error("Error loading submissions:", err);
    } finally {
      setLoading(false);
    }
  };

  // Badge counts
  const counts = useMemo(() => {
    const c = {
      pending: 0,
      approved: 0,
      revision_requested: 0,
      faculty_head_review: 0,
      faculty_head_approved: 0,
      all: 0,
    };
    allSubmissions.forEach((s) => {
      c.all++;
      if (c[s.status] !== undefined) c[s.status]++;
    });
    return c;
  }, [allSubmissions]);

  // Reset page when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, search]);

  // Filter + search
  const filtered = useMemo(() => {
    let list = allSubmissions;
    if (filter !== "all") {
      list = list.filter((s) => s.status === filter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) => {
        const title = (s.quizzes?.title || "").toLowerCase();
        const p = s.profiles;
        const name = p
          ? `${p.first_name || ""} ${p.last_name || ""} ${p.username || ""} ${p.email || ""}`.toLowerCase()
          : "";
        return title.includes(q) || name.includes(q);
      });
    }
    return list;
  }, [allSubmissions, filter, search]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginatedSubmissions = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  const getInstructorName = (submission) => {
    const p = submission.profiles;
    if (!p) return "Unknown Instructor";
    const name = `${p.first_name || ""} ${p.last_name || ""}`.trim();
    return name || p.username || p.email || "Unknown Instructor";
  };

  const getInitials = (submission) => {
    const p = submission.profiles;
    if (!p) return "?";
    if (p.first_name || p.last_name) {
      return (
        ((p.first_name || "")[0] + (p.last_name || "")[0]).toUpperCase() || "?"
      );
    }
    return (p.username || p.email || "?")[0].toUpperCase();
  };

  const avatarColors = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-purple-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-cyan-500",
    "bg-indigo-500",
    "bg-teal-500",
  ];

  const getAvatarColor = (id) => {
    let hash = 0;
    for (let i = 0; i < (id || "").length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return avatarColors[Math.abs(hash) % avatarColors.length];
  };

  const getStatusBadge = (status) => {
    const config = {
      pending: { bg: "bg-yellow-100 text-yellow-700", label: "Pending" },
      approved: { bg: "bg-green-100 text-green-700", label: "Approved" },
      revision_requested: {
        bg: "bg-orange-100 text-orange-700",
        label: "Revision",
      },
      faculty_head_review: {
        bg: "bg-blue-100 text-blue-700",
        label: "Department Head",
      },
      faculty_head_approved: {
        bg: "bg-green-100 text-green-700",
        label: "DH Approved",
      },
    };
    const c = config[status] || {
      bg: "bg-gray-100 text-gray-600",
      label: status,
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${c.bg}`}>
        {c.label}
      </span>
    );
  };

  const timeAgo = (dateStr) => {
    if (!dateStr) return "—";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const getTosStatus = (summary) => {
    if (!summary) return null;
    const lotsPct = summary.lotsPercentage || 0;
    const hotsPct = summary.hotsPercentage || 0;
    return Math.abs(lotsPct - 30) <= 5 && Math.abs(hotsPct - 70) <= 5;
  };

  const tabs = [
    { key: "pending", label: "Pending", dotColor: "bg-yellow-400" },
    {
      key: "faculty_head_review",
      label: "Department Head",
      dotColor: "bg-blue-500",
    },
    {
      key: "faculty_head_approved",
      label: "DH Approved",
      dotColor: "bg-green-500",
    },
    { key: "revision_requested", label: "Revision", dotColor: "bg-orange-500" },
    { key: "all", label: "All", dotColor: "bg-gray-400" },
  ];

  const emptyMessages = {
    pending: {
      title: "No Pending Reviews",
      desc: "All quiz submissions have been reviewed. New submissions will appear here.",
    },
    approved: {
      title: "No Approved Submissions",
      desc: "Approved quiz analyses will appear here after review.",
    },
    revision_requested: {
      title: "No Revision Requests",
      desc: "Submissions sent back for revision will appear here.",
    },
    all: {
      title: "No Submissions Yet",
      desc: "Quiz analysis submissions from instructors will appear here.",
    },
  };

  return (
    <>
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-brand-navy to-brand-indigo px-6 py-8">
        <p className="text-brand-gold text-sm font-semibold uppercase tracking-widest mb-1">
          Senior Faculty
        </p>
        <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
          Quiz Analysis Reviews
          {counts.pending > 0 && (
            <span className="flex items-center gap-2 px-3 py-1 bg-yellow-400/20 rounded-full">
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              <span className="text-sm font-bold text-yellow-300">
                {counts.pending} pending
              </span>
            </span>
          )}
        </h1>
        <p className="text-white/60 text-sm mt-1">
          Review and approve quiz analyses submitted by instructors
        </p>
      </div>

      <div className="p-6">
        {/* Search + Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          {/* Search */}
          <div className="relative flex-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
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
            <input
              type="text"
              placeholder="Search by quiz title or instructor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold focus:border-transparent"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex bg-gray-100 rounded-xl p-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  filter === tab.key
                    ? "bg-white text-gray-800 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${tab.dotColor}`} />
                {tab.label}
                <span
                  className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                    filter === tab.key
                      ? "bg-brand-navy text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {counts[tab.key]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Submissions List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-gold mx-auto mb-3"></div>
              <p className="text-gray-500 text-sm">Loading submissions...</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-200">
            <div className="w-16 h-16 mx-auto mb-4 bg-brand-navy/10 rounded-2xl flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 text-brand-navy"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-700 mb-2">
              {search
                ? "No Results Found"
                : emptyMessages[filter]?.title || "No Submissions"}
            </h3>
            <p className="text-gray-400 text-sm max-w-sm mx-auto">
              {search
                ? `No submissions match "${search}". Try a different search term.`
                : emptyMessages[filter]?.desc || "No submissions found."}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {paginatedSubmissions.map((submission) => {
                const summary = submission.analysis_results?.summary;
                const tosCompliant = getTosStatus(summary);
                const lotsPct = summary?.lotsPercentage || 0;
                const hotsPct = summary?.hotsPercentage || 0;
                const instructorName = getInstructorName(submission);

                return (
                  <div
                    key={submission.id}
                    onClick={() =>
                      navigate(`/admin-dashboard/quiz-reviews/${submission.id}`)
                    }
                    className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-brand-gold/30 transition-all p-5 cursor-pointer group"
                  >
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div
                        className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${getAvatarColor(
                          submission.instructor_id,
                        )}`}
                      >
                        {getInitials(submission)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Title Row */}
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-bold text-gray-800 group-hover:text-brand-navy transition-colors truncate">
                            {(
                              submission.quizzes?.title || "Untitled Quiz"
                            ).replace(/\s*\(Revised(?:\s+\d+)?\)\s*$/, "")}
                          </h3>
                          {(submission.quizzes?.version_number || 0) > 1 && (
                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 border border-indigo-300 rounded-full text-[10px] font-bold">
                              V{submission.quizzes.version_number}
                            </span>
                          )}
                          {submission.previous_submission_id && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 border border-blue-200 rounded-full text-[10px] font-bold">
                              Resubmission
                            </span>
                          )}
                          {getStatusBadge(submission.status)}
                          {tosCompliant !== null && (
                            <span
                              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                tosCompliant
                                  ? "bg-green-50 text-green-600"
                                  : "bg-red-50 text-red-600"
                              }`}
                            >
                              {tosCompliant ? (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-3 w-3"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={3}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              ) : (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-3 w-3"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={3}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M6 18L18 6M6 6l12 12"
                                  />
                                </svg>
                              )}
                              TOS
                            </span>
                          )}
                        </div>

                        {/* Instructor + Time */}
                        <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
                          <span>
                            by{" "}
                            <span className="font-semibold text-gray-600">
                              {instructorName}
                            </span>
                          </span>
                          <span className="flex items-center gap-1">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-3 w-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            {timeAgo(submission.created_at)}
                          </span>
                        </div>

                        {/* Stats Row */}
                        {summary && (
                          <div className="flex items-center gap-3 flex-wrap">
                            {/* Question count pill */}
                            <span className="flex items-center gap-1 px-2.5 py-1 bg-brand-navy/10 rounded-lg text-xs font-semibold text-brand-navy">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-3.5 w-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              {summary.totalQuestions} questions
                            </span>

                            {/* LOTS/HOTS mini bar */}
                            <div className="flex items-center gap-2">
                              <div className="flex h-2 w-24 rounded-full overflow-hidden bg-gray-100">
                                {lotsPct > 0 && (
                                  <div
                                    className="bg-emerald-500 transition-all"
                                    style={{ width: `${lotsPct}%` }}
                                  />
                                )}
                                {hotsPct > 0 && (
                                  <div
                                    className="bg-amber-500 transition-all"
                                    style={{ width: `${hotsPct}%` }}
                                  />
                                )}
                              </div>
                              <span className="text-[11px] text-gray-400 font-medium">
                                <span className="text-emerald-600 font-semibold">
                                  {lotsPct}%
                                </span>
                                {" / "}
                                <span className="text-amber-600 font-semibold">
                                  {hotsPct}%
                                </span>
                              </span>
                            </div>

                            {/* Flagged */}
                            {summary.flaggedCount > 0 && (
                              <span className="flex items-center gap-1 px-2 py-1 bg-red-50 rounded-lg text-xs font-semibold text-red-600">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-3.5 w-3.5"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                                  />
                                </svg>
                                {summary.flaggedCount} flagged
                              </span>
                            )}
                          </div>
                        )}

                        {/* Instructor Message */}
                        {submission.instructor_message && (
                          <div className="mt-3 flex items-start gap-2 p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                              />
                            </svg>
                            <p className="text-xs text-gray-500 line-clamp-2">
                              {submission.instructor_message}
                            </p>
                          </div>
                        )}

                        {/* Senior Faculty Feedback (for revision) */}
                        {submission.status === "revision_requested" &&
                          submission.admin_feedback && (
                            <div className="mt-2 flex items-start gap-2 p-2.5 rounded-lg border bg-orange-50 border-orange-100">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-3.5 w-3.5 shrink-0 mt-0.5 text-orange-400"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                                />
                              </svg>
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5 text-orange-600">
                                  Senior Faculty Feedback
                                </p>
                                <p className="text-xs line-clamp-2 text-orange-700">
                                  {submission.admin_feedback}
                                </p>
                              </div>
                            </div>
                          )}
                      </div>

                      {/* Review Arrow */}
                      <div className="shrink-0 flex items-center self-center">
                        <div className="w-9 h-9 rounded-lg bg-brand-gold/10 flex items-center justify-center group-hover:bg-brand-navy transition-colors">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 text-brand-navy group-hover:text-white transition-colors"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-gray-500">
                  Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                  {Math.min(currentPage * PAGE_SIZE, filtered.length)} of{" "}
                  {filtered.length}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-sm font-semibold rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Prev
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-9 h-9 text-sm font-semibold rounded-lg transition-colors ${
                          currentPage === page
                            ? "bg-brand-gold text-white"
                            : "border border-gray-200 hover:bg-gray-50 text-gray-600"
                        }`}
                      >
                        {page}
                      </button>
                    ),
                  )}
                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 text-sm font-semibold rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};
