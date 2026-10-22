import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { notify } from "../../utils/notify.jsx";
import { Skeleton } from "../../components/ui/Skeleton.jsx";
import { ProfileAvatar } from "../../components/ui/ProfileAvatar.jsx";
import {
  HEAD_STATUSES,
  loadHeadSubmissions,
  countHeadSubmissions,
  cleanQuizTitle,
  getProfileName,
  exportSubmissionTosPdf,
  exportSubmissionQuizPaper,
} from "../../services/facultyHeadService.js";
import { formatReviewerLabel } from "../../utils/reviewerLabel.js";

const TAB_KEYS = [
  HEAD_STATUSES.PENDING,
  HEAD_STATUSES.APPROVED,
  HEAD_STATUSES.RETURNED,
  "all",
];

export const FacultyHeadQuizApprovals = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [allSubmissions, setAllSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  // `${submissionId}:pdf` | `${submissionId}:paper` while an export is generating
  const [exporting, setExporting] = useState(null);
  const PAGE_SIZE = 10;

  const tabParam = searchParams.get("tab");
  const filter = TAB_KEYS.includes(tabParam) ? tabParam : HEAD_STATUSES.PENDING;
  const setFilter = (key) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", key);
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    loadSubmissions();
    window.addEventListener("pending-quiz-approvals-changed", loadSubmissions);
    return () =>
      window.removeEventListener("pending-quiz-approvals-changed", loadSubmissions);
  }, []);

  // Reset pagination on search or tab change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filter]);

  const loadSubmissions = async () => {
    try {
      setAllSubmissions(await loadHeadSubmissions());
    } catch (err) {
      console.error("Error loading submissions:", err);
      notify.error("Failed to load exam approvals.");
    } finally {
      setLoading(false);
    }
  };

  const counts = useMemo(() => countHeadSubmissions(allSubmissions), [allSubmissions]);

  const filtered = useMemo(() => {
    let list = allSubmissions;
    if (filter !== "all") {
      list = list.filter((s) => s.status === filter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((s) =>
        [
          s.quizzes?.title,
          getProfileName(s.profiles, ""),
          s.profiles?.email,
          getProfileName(s.reviewer, ""),
          s.section?.name,
          s.section?.subject_code,
        ]
          .filter(Boolean)
          .some((v) => v.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [allSubmissions, filter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginated = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const getStatusBadge = (status) => {
    const config = {
      faculty_head_review: {
        bg: "bg-yellow-100 text-yellow-700",
        label: "Pending Approval",
      },
      faculty_head_approved: {
        bg: "bg-green-100 text-green-700",
        label: "Approved",
      },
      revision_requested: {
        bg: "bg-orange-100 text-orange-700",
        label: "Returned for Revision",
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
    if (!dateStr) return "";
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

  const runExport = async (e, submission, kind) => {
    e.stopPropagation();
    if (exporting) return;
    setExporting(`${submission.id}:${kind}`);
    try {
      if (kind === "pdf") {
        await exportSubmissionTosPdf(submission, user?.id);
      } else {
        await exportSubmissionQuizPaper(submission, user?.id);
      }
    } catch (err) {
      console.error("Export failed:", err);
      notify.error("Export failed. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  const tabs = [
    { key: HEAD_STATUSES.PENDING, label: "Pending", dotColor: "bg-yellow-400" },
    { key: HEAD_STATUSES.APPROVED, label: "Approved", dotColor: "bg-green-500" },
    { key: HEAD_STATUSES.RETURNED, label: "Returned", dotColor: "bg-orange-500" },
    { key: "all", label: "All", dotColor: "bg-gray-400" },
  ];

  const emptyMessages = {
    faculty_head_review: "No exams are waiting for your approval.",
    faculty_head_approved: "Exams you approve will appear here.",
    revision_requested: "Exams you return for revision will appear here so you can track them.",
    all: "Exam analyses forwarded by reviewers will appear here.",
  };

  const Spinner = () => (
    <span className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
  );

  if (loading) {
    return (
      <div className="flex-1 overflow-auto bg-authentic-white" aria-label="Loading exam approvals">
        <div className="bg-gradient-to-r from-brand-navy to-brand-indigo px-6 py-8">
          <Skeleton tone="bg-white/20" className="h-4 w-36 rounded-md mb-2" />
          <Skeleton tone="bg-white/20" className="h-8 w-52 max-w-full rounded-md mb-2" />
          <Skeleton tone="bg-white/20" className="h-4 w-72 max-w-full rounded-md" />
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6">
            <Skeleton className="h-5 w-1/3 rounded-md mb-3" />
            <Skeleton className="h-3 w-full rounded-md mb-2" />
            <Skeleton className="h-3 w-2/3 rounded-md" />
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6">
            <Skeleton className="h-5 w-1/4 rounded-md mb-3" />
            <Skeleton className="h-3 w-full rounded-md mb-2" />
            <Skeleton className="h-3 w-1/2 rounded-md" />
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6">
            <Skeleton className="h-5 w-1/3 rounded-md mb-3" />
            <Skeleton className="h-3 w-3/4 rounded-md" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-brand-navy to-brand-indigo px-6 py-8">
        <p className="text-brand-gold text-sm font-semibold uppercase tracking-widest mb-1">
          Department Head
        </p>
        <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
          Exam Approvals
          {counts.faculty_head_review > 0 && (
            <span className="flex items-center gap-2 px-3 py-1 bg-yellow-400/20 rounded-full">
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              <span className="text-sm font-bold text-yellow-300">
                {counts.faculty_head_review} pending
              </span>
            </span>
          )}
        </h1>
        <p className="text-white/60 text-sm mt-1">
          Approve exam analyses forwarded by peer reviewers and Senior Faculty
        </p>
      </div>

      <div className="p-6">
        {/* Search + Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <label htmlFor="approvals-search" className="sr-only">
              Search by exam, instructor, reviewer, or subject
            </label>
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
              id="approvals-search"
              type="text"
              placeholder="Search by exam, instructor, reviewer, or subject..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm text-brand-navy placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-gold/20 focus:border-brand-gold transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 rounded"
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

          <div className="flex bg-gray-100 rounded-xl p-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                aria-pressed={filter === tab.key}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 ${
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
        {filtered.length === 0 ? (
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
              {search ? "No Results Found" : "No Submissions"}
            </h3>
            <p className="text-gray-400 text-sm max-w-sm mx-auto">
              {search ? `No submissions match "${search}".` : emptyMessages[filter]}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-3">
              {paginated.map((submission) => {
                const summary = submission.analysis_results?.summary;
                const lotsPct = summary?.lotsPercentage || 0;
                const hotsPct = summary?.hotsPercentage || 0;
                const quizTitle = cleanQuizTitle(submission.quizzes?.title);
                const instructorName = getProfileName(submission.profiles, "Unknown Instructor");
                const reviewerName = submission.reviewer
                  ? `${getProfileName(submission.reviewer)} (${submission.reviewer.is_admin ? "Senior Faculty" : "Peer Reviewer"})`
                  : null;
                const isReturned = submission.status === HEAD_STATUSES.RETURNED;

                return (
                  <div
                    key={submission.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Review ${quizTitle} by ${instructorName}`}
                    onClick={() =>
                      navigate(`/faculty-head-dashboard/exam-approvals/${submission.id}`)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/faculty-head-dashboard/exam-approvals/${submission.id}`);
                      }
                    }}
                    className="bg-white rounded-2xl border border-gray-200 shadow-xs hover:shadow-lg hover:-translate-y-0.5 hover:border-brand-gold/30 transition-all p-5 cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
                  >
                    <div className="flex items-start gap-4">
                      <ProfileAvatar
                        profile={submission.profiles}
                        id={submission.instructor_id}
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-bold text-gray-800 group-hover:text-brand-navy transition-colors truncate">
                            {quizTitle}
                          </h3>
                          {getStatusBadge(submission.status)}
                          {submission.resubmitted && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-700">
                              Resubmitted — back in review
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400 mb-3">
                          <span>
                            by{" "}
                            <span className="font-semibold text-gray-600">{instructorName}</span>
                          </span>
                          {reviewerName && (
                            <span>
                              reviewed by{" "}
                              <span className="font-semibold text-gray-600">{reviewerName}</span>
                            </span>
                          )}
                          {submission.section && (
                            <span className="font-semibold text-gray-500">
                              {[submission.section.subject_code, submission.section.name]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          )}
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

                        {summary && (
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="flex items-center gap-1 px-2.5 py-1 bg-brand-navy/10 rounded-lg text-xs font-semibold text-brand-navy">
                              {summary.totalQuestions} questions
                            </span>

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

                            {summary.flaggedCount > 0 && (
                              <span className="flex items-center gap-1 px-2 py-1 bg-red-50 rounded-lg text-xs font-semibold text-red-600">
                                {summary.flaggedCount} flagged
                              </span>
                            )}
                          </div>
                        )}

                        {isReturned && submission.faculty_head_feedback && (
                          <div className="mt-3 p-2.5 bg-orange-50 rounded-lg border border-orange-100">
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5 text-orange-600">
                              Your Revision Request
                            </p>
                            <p className="text-xs text-orange-800 line-clamp-2">
                              {submission.faculty_head_feedback}
                            </p>
                          </div>
                        )}

                        {submission.admin_feedback && (
                          <div className="mt-3 p-2.5 bg-blue-50 rounded-lg border border-blue-100">
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5 text-blue-600">
                              {formatReviewerLabel(submission.reviewer)}
                            </p>
                            <p className="text-xs text-blue-700 line-clamp-2">
                              {submission.admin_feedback}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 flex items-center self-center gap-2">
                        {submission.status === HEAD_STATUSES.APPROVED && (
                          <>
                            <button
                              onClick={(e) => runExport(e, submission, "pdf")}
                              disabled={!!exporting}
                              aria-busy={exporting === `${submission.id}:pdf`}
                              className="px-3 py-1.5 bg-brand-navy hover:bg-brand-navy/90 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/40"
                              title="Export TOS PDF"
                            >
                              {exporting === `${submission.id}:pdf` ? <Spinner /> : null}
                              {exporting === `${submission.id}:pdf` ? "Exporting…" : "PDF"}
                            </button>
                            <button
                              onClick={(e) => runExport(e, submission, "paper")}
                              disabled={!!exporting}
                              aria-busy={exporting === `${submission.id}:paper`}
                              className="px-3 py-1.5 bg-brand-navy hover:bg-brand-indigo text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/40"
                              title="Export Exam Paper"
                            >
                              {exporting === `${submission.id}:paper` ? <Spinner /> : null}
                              {exporting === `${submission.id}:paper` ? "Exporting…" : "Exam Paper"}
                            </button>
                          </>
                        )}
                        <div className="w-9 h-9 rounded-lg bg-brand-gold/10 flex items-center justify-center group-hover:bg-brand-navy transition-colors">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 text-brand-navy group-hover:text-white transition-colors"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls Bar */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-200 text-xs font-semibold text-gray-600 bg-white p-4 rounded-xl shadow-xs">
                <span>
                  Showing <strong>{startIndex + 1}</strong>–
                  <strong>{Math.min(startIndex + PAGE_SIZE, filtered.length)}</strong> of{" "}
                  <strong>{filtered.length}</strong> submissions
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    aria-label="Previous page"
                    className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold transition-colors shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
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
                          aria-label={`Go to page ${page}`}
                          aria-current={currentPage === page ? "page" : undefined}
                          className={`w-8 h-8 rounded-lg font-bold text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 ${
                            currentPage === page
                              ? "bg-brand-navy text-white shadow-xs"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                        >
                          {page}
                        </button>
                      );
                    } else if (page === currentPage - 2 || page === currentPage + 2) {
                      return <span key={page} className="px-1 text-gray-400">...</span>;
                    }
                    return null;
                  })}
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    aria-label="Next page"
                    className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold transition-colors shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};
