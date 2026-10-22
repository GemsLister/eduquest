import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { adminService } from "../../services/adminService.js";
import { useInstructorStatusToggle } from "../../hooks/adminHook/useInstructorStatusToggle.jsx";
import { ChangePasswordModal } from "../../components/admin/ChangePasswordModal.jsx";
import { Skeleton, SkeletonTableRow } from "../../components/ui/Skeleton.jsx";
import {
  getSubmissionStatusLabel,
  getSubmissionStatusStyle,
  isApprovedStatus,
  isReturnedByHead,
  isTosCompliant,
} from "../../utils/submissionStatus.js";
import {
  formatAuditAction,
  formatAuditStatus,
  formatAuditTable,
  getActionBadgeColor,
  getAuditItemName,
} from "../../utils/auditFormat.js";
import {
  getAvatarColor,
  getProfileInitials,
  getProfileName,
} from "../../utils/profileName.js";

const PAGE_SIZE = 10;

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "quizzes", label: "Exams" },
  { key: "submissions", label: "Exam Submissions" },
  { key: "reviews", label: "Peer Reviews" },
  { key: "activity", label: "Recent Activity" },
];

const cleanTitle = (title) =>
  (title || "Untitled Exam").replace(/\s*\(Revised(?:\s+\d+)?\)\s*$/i, "");

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

const formatDuration = (hours) => {
  if (hours == null) return "—";
  if (hours < 1) return "< 1 hour";
  if (hours < 24) return `${Math.round(hours)} ${Math.round(hours) === 1 ? "hour" : "hours"}`;
  const days = hours / 24;
  return `${days.toFixed(days < 10 ? 1 : 0)} days`;
};

const percent = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : null);

// Submission chain root: revisions point at the original quiz
const chainRootId = (s) => s.quizzes?.parent_quiz_id || s.quiz_id;

const SectionTitle = ({ children }) => (
  <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3">{children}</h2>
);

const StatCard = ({ label, value, hint, valueClass = "text-brand-navy" }) => (
  <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5">
    <p className="text-sm text-gray-500 font-medium">{label}</p>
    <p className={`text-3xl font-black mt-1 ${valueClass}`}>{value}</p>
    {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
  </div>
);

const EmptyState = ({ title, desc }) => (
  <div className="bg-white rounded-2xl p-12 text-center shadow-xs border border-gray-200">
    <div className="w-14 h-14 mx-auto mb-3 bg-gray-100 rounded-xl flex items-center justify-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-7 w-7 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
        />
      </svg>
    </div>
    <p className="text-sm font-semibold text-gray-600">{title}</p>
    <p className="text-xs text-gray-400 mt-1">{desc}</p>
  </div>
);

const SubmissionBadge = ({ submission }) => (
  <span
    className={`px-2.5 py-0.5 rounded-full text-xs font-bold border whitespace-nowrap ${getSubmissionStatusStyle(submission.status)}`}
  >
    {isReturnedByHead(submission)
      ? "Returned by Department Head"
      : getSubmissionStatusLabel(submission.status)}
  </span>
);

// Same states as the instructor's own "My Quizzes" page
const getQuizState = (quiz, latestSubmission) => {
  if (quiz.is_archived) return { label: "Archived", style: "bg-slate-100 text-slate-600 border-slate-200" };
  if (quiz.is_published) return { label: "Published", style: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (latestSubmission) {
    return {
      label: isReturnedByHead(latestSubmission)
        ? "Returned by Department Head"
        : getSubmissionStatusLabel(latestSubmission.status),
      style: getSubmissionStatusStyle(latestSubmission.status),
    };
  }
  return { label: "Draft", style: "bg-slate-100 text-slate-600 border-slate-200" };
};

const Pager = ({ page, totalPages, total, noun, onChange }) => {
  if (totalPages <= 1) return null;
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-slate-200">
      <p className="text-xs text-slate-500">
        Showing <strong className="text-slate-900">{(page - 1) * PAGE_SIZE + 1}</strong>–
        <strong className="text-slate-900">{Math.min(page * PAGE_SIZE, total)}</strong> of{" "}
        <strong className="text-slate-900">{total}</strong> {noun}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page === 1}
          aria-label="Previous page"
          className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
        >
          Prev
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            aria-label={`Go to page ${n}`}
            aria-current={page === n ? "page" : undefined}
            className={`w-8 h-8 text-xs font-bold rounded-lg transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 ${
              page === n
                ? "bg-brand-navy text-white shadow-xs"
                : "border border-slate-200 hover:bg-slate-50 text-slate-600"
            }`}
          >
            {n}
          </button>
        ))}
        <button
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          aria-label="Next page"
          className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
        >
          Next
        </button>
      </div>
    </div>
  );
};

// Client-side pagination with the page clamped to the list length
const usePaged = (list) => {
  const [requested, setPage] = useState(1);
  const totalPages = Math.ceil(list.length / PAGE_SIZE);
  const page = Math.min(requested, Math.max(totalPages, 1));
  const items = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return { page, totalPages, items, setPage };
};

const TABLE_WRAP = "bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden";
const TH_ROW =
  "bg-gray-50/80 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider";

export const AdminInstructorDetail = () => {
  const { instructorId } = useParams();
  const navigate = useNavigate();
  const { statusLoading, toggleStatus } = useInstructorStatusToggle();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [tab, setTab] = useState("overview");
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    adminService
      .getInstructorOverview(instructorId)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setLoadError(false);
      })
      .catch((err) => {
        console.error("Error loading instructor:", err);
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [instructorId]);

  const profile = data?.profile || null;
  const quizzes = useMemo(() => data?.quizzes || [], [data]);
  const sections = useMemo(() => data?.sections || [], [data]);
  const submissions = useMemo(() => data?.submissions || [], [data]);
  const reviews = useMemo(() => data?.reviews || [], [data]);
  const activity = useMemo(() => data?.activity || [], [data]);

  const peopleById = useMemo(
    () => new Map((data?.people || []).map((p) => [p.id, p])),
    [data],
  );

  // Latest submission per quiz (submissions arrive newest first)
  const latestSubmissionByQuiz = useMemo(() => {
    const map = new Map();
    submissions.forEach((s) => {
      if (!map.has(s.quiz_id)) map.set(s.quiz_id, s);
    });
    return map;
  }, [submissions]);

  const attemptsByQuiz = useMemo(
    () => new Map((data?.attemptCounts || []).map((a) => [a.quiz_id, a])),
    [data],
  );

  // Version numbers within each quiz's submission chain
  const versionBySubmission = useMemo(() => {
    const countByChain = new Map();
    const versions = new Map();
    // Oldest first, so the original is V1
    [...submissions].reverse().forEach((s) => {
      const key = chainRootId(s);
      const next = (countByChain.get(key) || 0) + 1;
      countByChain.set(key, next);
      versions.set(s.id, next);
    });
    return versions;
  }, [submissions]);

  const stats = useMemo(() => {
    const active = quizzes.filter((q) => !q.is_archived);
    const published = active.filter((q) => q.is_published).length;

    // Exam-level figures use the newest submission of each chain
    const latestPerChain = [];
    const seen = new Set();
    submissions.forEach((s) => {
      const key = chainRootId(s);
      if (seen.has(key)) return;
      seen.add(key);
      latestPerChain.push(s);
    });
    const withSummary = latestPerChain.filter((s) => s.summary);
    const tosCompliant = withSummary.filter((s) => isTosCompliant(s.summary)).length;
    const avg = (key) =>
      withSummary.length
        ? Math.round(
            withSummary.reduce((sum, s) => sum + (s.summary[key] || 0), 0) / withSummary.length,
          )
        : null;

    const decided = submissions.filter(
      (s) => !["pending", "faculty_head_review"].includes(s.status),
    );
    const revisions = decided.filter((s) => s.status === "revision_requested").length;

    const completedReviews = reviews.filter(
      (r) => r.reviewed_by === profile?.id && r.reviewed_at,
    );
    const turnaroundHours = completedReviews.length
      ? completedReviews.reduce(
          (sum, r) => sum + (new Date(r.reviewed_at) - new Date(r.created_at)) / 36e5,
          0,
        ) / completedReviews.length
      : null;

    return {
      totalQuizzes: active.length,
      published,
      drafts: active.length - published,
      archived: quizzes.length - active.length,
      exams: latestPerChain.length,
      approvedExams: latestPerChain.filter((s) => isApprovedStatus(s.status)).length,
      inReview: latestPerChain.filter((s) => ["pending", "faculty_head_review"].includes(s.status))
        .length,
      tosRate: percent(tosCompliant, withSummary.length),
      tosCompliant,
      tosChecked: withSummary.length,
      avgLots: avg("lotsPercentage"),
      avgHots: avg("hotsPercentage"),
      revisionRate: percent(revisions, decided.length),
      completedAttempts: data?.attemptCounts
        ? data.attemptCounts.reduce((sum, a) => sum + Number(a.completed_attempts || 0), 0)
        : null,
      assignedReviews: reviews.length,
      pendingReviews: reviews.filter((r) => r.status === "pending").length,
      completedReviews: completedReviews.length,
      turnaroundHours,
    };
  }, [quizzes, submissions, reviews, profile?.id, data]);

  // Active sections grouped under their subject
  const subjects = useMemo(() => {
    const quizCountBySection = new Map();
    quizzes.forEach((q) => {
      if (q.is_archived) return;
      // An exam can be assigned to several sections; section_id is only the legacy first one
      const sectionIds = new Set([
        ...(q.quiz_sections || []).map((qs) => qs.section_id),
        q.section_id,
      ].filter(Boolean));
      sectionIds.forEach((id) => {
        quizCountBySection.set(id, (quizCountBySection.get(id) || 0) + 1);
      });
    });
    const groups = new Map();
    sections
      .filter((s) => !s.is_archived)
      .forEach((s) => {
        const key = s.subject_id || "none";
        if (!groups.has(key)) {
          groups.set(key, {
            key,
            name: s.subjects?.name || "No subject",
            code: s.subjects?.code || null,
            sections: [],
          });
        }
        groups.get(key).sections.push({ ...s, quizCount: quizCountBySection.get(s.id) || 0 });
      });
    return [...groups.values()];
  }, [sections, quizzes]);

  const sectionNameById = useMemo(
    () => new Map(sections.map((s) => [s.id, s.name])),
    [sections],
  );

  const quizPages = usePaged(quizzes);
  const submissionPages = usePaged(submissions);
  const reviewPages = usePaged(reviews);
  const activityPages = usePaged(activity);

  const handleToggleStatus = async () => {
    const disabled = await toggleStatus(profile);
    if (disabled !== null) {
      setData((prev) => ({ ...prev, profile: { ...prev.profile, is_disabled: disabled } }));
    }
  };

  const backButton = (
    <button
      onClick={() => navigate("/admin-dashboard/instructors")}
      aria-label="Back to instructors"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-semibold transition-all mb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Back to Instructors
    </button>
  );

  if (loading) {
    return (
      <div className="flex-1 overflow-auto bg-authentic-white" aria-label="Loading instructor">
        <div className="bg-gradient-to-r from-brand-navy to-brand-indigo px-6 py-8">
          <Skeleton tone="bg-white/20" className="h-8 w-40 rounded-lg mb-4" />
          <div className="flex items-center gap-4">
            <Skeleton tone="bg-white/20" className="h-16 w-16 rounded-full shrink-0" />
            <div className="flex-1">
              <Skeleton tone="bg-white/20" className="h-4 w-32 rounded-md mb-2" />
              <Skeleton tone="bg-white/20" className="h-8 w-64 max-w-full rounded-md mb-2" />
              <Skeleton tone="bg-white/20" className="h-4 w-80 max-w-full rounded-md" />
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
          </div>
          <div className={TABLE_WRAP}>
            <SkeletonTableRow cells={4} />
            <SkeletonTableRow cells={4} />
            <SkeletonTableRow cells={4} />
          </div>
        </div>
      </div>
    );
  }

  if (loadError || !profile) {
    return (
      <>
        <div className="bg-gradient-to-r from-brand-navy to-brand-indigo px-6 py-8">
          {backButton}
          <p className="text-brand-gold text-sm font-semibold tracking-widest uppercase mb-1">
            Senior Faculty
          </p>
          <h1 className="text-2xl md:text-3xl font-black text-white">Instructor Details</h1>
        </div>
        <div className="p-6">
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center">
            <p className="text-rose-700 text-sm font-semibold">
              {loadError
                ? "Couldn't load this instructor. Please try again."
                : "Instructor not found. The account may have been removed, or it isn't an instructor account."}
            </p>
          </div>
        </div>
      </>
    );
  }

  const name = getProfileName(profile);
  const isDisabled = profile.is_disabled === true;
  const tabCounts = {
    quizzes: quizzes.length,
    submissions: submissions.length,
    reviews: reviews.length,
    activity: activity.length,
  };

  return (
    <>
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-brand-navy to-brand-indigo px-6 py-8">
        {backButton}
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                className="h-16 w-16 rounded-full object-cover ring-2 ring-brand-gold/40 shrink-0"
              />
            ) : (
              <div
                className={`h-16 w-16 rounded-full flex items-center justify-center text-white text-xl font-bold ring-2 ring-white/20 shrink-0 ${
                  isDisabled ? "bg-gray-400" : getAvatarColor(profile.id)
                }`}
              >
                {getProfileInitials(profile)}
              </div>
            )}
            <div className="min-w-0">
              {/* The account's own role, not the portal being viewed */}
              <p className="text-brand-gold text-sm font-semibold tracking-widest uppercase mb-1">
                {profile.is_faculty_head
                  ? "Department Head"
                  : profile.is_admin
                    ? "Senior Faculty"
                    : "Instructor"}
              </p>
              <h1 className="text-2xl md:text-3xl font-black text-white flex flex-wrap items-center gap-3">
                <span className="truncate">{name}</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    isDisabled
                      ? "bg-amber-400/20 text-amber-200 border-amber-400/30"
                      : "bg-emerald-400/20 text-emerald-200 border-emerald-400/30"
                  }`}
                >
                  {isDisabled ? "Disabled" : "Active"}
                </span>
              </h1>
              <p className="text-white/60 text-sm mt-1 break-words">
                @{profile.username || "—"} · {profile.email || "—"} · Joined{" "}
                {formatDate(profile.created_at)}
              </p>
            </div>
          </div>

          {/* Account actions */}
          <div className="flex flex-wrap gap-2 lg:ml-auto">
            <button
              type="button"
              onClick={() => setShowPasswordModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70"
            >
              Change Password
            </button>
            <button
              type="button"
              onClick={handleToggleStatus}
              disabled={statusLoading === profile.id}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-semibold transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70 ${
                isDisabled
                  ? "bg-emerald-400/20 hover:bg-emerald-400/30 border-emerald-400/30 text-emerald-100"
                  : "bg-amber-400/20 hover:bg-amber-400/30 border-amber-400/30 text-amber-100"
              }`}
            >
              {statusLoading === profile.id
                ? isDisabled
                  ? "Enabling..."
                  : "Disabling..."
                : isDisabled
                  ? "Enable Account"
                  : "Disable Account"}
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Tabs */}
        <div className="flex bg-slate-100/80 rounded-2xl p-1 border border-slate-200/80 overflow-x-auto mb-6 w-fit max-w-full">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              aria-pressed={tab === t.key}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 ${
                tab === t.key ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {t.label}
              {tabCounts[t.key] !== undefined && (
                <span
                  className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    tab === t.key ? "bg-brand-navy text-white" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {tabCounts[t.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === "overview" && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Exams"
                value={stats.totalQuizzes}
                hint={`${stats.published} published · ${stats.drafts} not published`}
              />
              <StatCard
                label="Exams Submitted"
                value={stats.exams}
                hint={`${stats.inReview} currently in review`}
              />
              <StatCard
                label="Approved Exams"
                value={stats.approvedExams}
                valueClass="text-emerald-600"
                hint="Approved by the Department Head"
              />
              <StatCard
                label="Completed Attempts"
                value={stats.completedAttempts ?? "—"}
                hint="Student attempts across all exams"
              />
            </div>

            {profile.bio && (
              <div>
                <SectionTitle>About</SectionTitle>
                <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6">
                  <p className="text-sm text-gray-700 whitespace-pre-line">{profile.bio}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Exam quality */}
              <div>
                <SectionTitle>Exam Quality</SectionTitle>
                <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 space-y-4">
                  {stats.tosChecked === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">
                      No analysed exams yet. Quality figures appear after the first submission.
                    </p>
                  ) : (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">TOS Compliance</span>
                        <span className="text-lg font-bold text-brand-navy">
                          {stats.tosRate}%{" "}
                          <span className="text-xs font-medium text-gray-400">
                            ({stats.tosCompliant} of {stats.tosChecked} exams)
                          </span>
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Average LOTS / HOTS</span>
                        <span className="text-lg font-bold">
                          <span className="text-emerald-600">{stats.avgLots}%</span>
                          <span className="text-gray-300"> / </span>
                          <span className="text-amber-600">{stats.avgHots}%</span>
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Revision Rate</span>
                        <span className="text-lg font-bold text-rose-600">
                          {stats.revisionRate ?? "—"}
                          {stats.revisionRate != null && "%"}
                        </span>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500">
                          Based on each exam's latest submission. School TOS requires{" "}
                          <span className="font-semibold text-gray-700">30% LOTS / 70% HOTS</span>{" "}
                          with 5% tolerance; revision rate is the share of review decisions that
                          asked for changes.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* As a peer reviewer */}
              <div>
                <SectionTitle>As a Peer Reviewer</SectionTitle>
                <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Reviews Assigned</span>
                    <span className="text-lg font-bold text-brand-navy">{stats.assignedReviews}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Completed</span>
                    <span className="text-lg font-bold text-emerald-600">{stats.completedReviews}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Waiting on Them</span>
                    <span className="text-lg font-bold text-amber-600">{stats.pendingReviews}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Average Response Time</span>
                    <span className="text-lg font-bold text-brand-navy">
                      {formatDuration(stats.turnaroundHours)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Subjects & sections */}
            <div>
              <SectionTitle>Subjects &amp; Sections</SectionTitle>
              {subjects.length === 0 ? (
                <EmptyState
                  title="No Sections Yet"
                  desc="Subjects and sections this instructor handles will appear here."
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {subjects.map((subject) => (
                    <div
                      key={subject.key}
                      className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5"
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <p className="font-bold text-gray-800 text-sm">{subject.name}</p>
                        {subject.code && (
                          <span className="px-2 py-0.5 bg-brand-navy/10 text-brand-navy rounded-full text-[10px] font-bold shrink-0">
                            {subject.code}
                          </span>
                        )}
                      </div>
                      <ul className="space-y-1.5">
                        {subject.sections.map((section) => (
                          <li
                            key={section.id}
                            className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2"
                          >
                            <span className="font-semibold text-gray-700 truncate">{section.name}</span>
                            <span className="text-gray-400 shrink-0">
                              {section.quizCount} {section.quizCount === 1 ? "exam" : "exams"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quizzes */}
        {tab === "quizzes" &&
          (quizzes.length === 0 ? (
            <EmptyState title="No Exams Yet" desc="Exams this instructor creates will appear here." />
          ) : (
            <>
              <div className={TABLE_WRAP}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className={TH_ROW}>
                        <th className="px-5 py-3.5">Exam</th>
                        <th className="px-5 py-3.5">Section</th>
                        <th className="px-5 py-3.5">Status</th>
                        <th className="px-5 py-3.5 text-right">Students</th>
                        <th className="px-5 py-3.5 text-right">Attempts</th>
                        <th className="px-5 py-3.5">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {quizPages.items.map((quiz) => {
                        const state = getQuizState(quiz, latestSubmissionByQuiz.get(quiz.id));
                        const attempts = attemptsByQuiz.get(quiz.id);
                        return (
                          <tr key={quiz.id} className="hover:bg-brand-navy/5 transition-colors">
                            <td className="px-5 py-4">
                              <div className="font-bold text-brand-navy">{cleanTitle(quiz.title)}</div>
                              {(quiz.version_number || 1) > 1 && (
                                <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-bold text-[10px]">
                                  V{quiz.version_number}
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-4 text-gray-600">
                              {[...new Set([...(quiz.quiz_sections || []).map((qs) => qs.section_id), quiz.section_id])]
                                .map((id) => sectionNameById.get(id))
                                .filter(Boolean)
                                .join(", ") || "—"}
                            </td>
                            <td className="px-5 py-4">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-xs font-bold border whitespace-nowrap ${state.style}`}
                              >
                                {state.label}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-right font-semibold text-gray-700">
                              {attempts ? attempts.student_count : "—"}
                            </td>
                            <td className="px-5 py-4 text-right font-semibold text-gray-700">
                              {attempts ? attempts.completed_attempts : "—"}
                            </td>
                            <td className="px-5 py-4 text-gray-500 whitespace-nowrap">
                              {formatDate(quiz.created_at)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <Pager
                page={quizPages.page}
                totalPages={quizPages.totalPages}
                total={quizzes.length}
                noun="exams"
                onChange={quizPages.setPage}
              />
            </>
          ))}

        {/* Exam submissions */}
        {tab === "submissions" &&
          (submissions.length === 0 ? (
            <EmptyState
              title="No Exam Submissions"
              desc="Exam analyses this instructor submits for review will appear here."
            />
          ) : (
            <>
              <div className={TABLE_WRAP}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className={TH_ROW}>
                        <th className="px-5 py-3.5">Exam</th>
                        <th className="px-5 py-3.5">Reviewer</th>
                        <th className="px-5 py-3.5">Submitted</th>
                        <th className="px-5 py-3.5">Status</th>
                        <th className="px-5 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {submissionPages.items.map((s) => {
                        const version = versionBySubmission.get(s.id) || 1;
                        const feedback = isReturnedByHead(s) ? s.faculty_head_feedback : s.admin_feedback;
                        const compliant = isTosCompliant(s.summary);
                        return (
                          <tr key={s.id} className="hover:bg-brand-navy/5 transition-colors align-top">
                            <td className="px-5 py-4">
                              <div className="font-bold text-brand-navy">{cleanTitle(s.quizzes?.title)}</div>
                              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500">
                                <span
                                  className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                                    version === 1 ? "bg-emerald-100 text-emerald-700" : "bg-indigo-100 text-indigo-700"
                                  }`}
                                >
                                  {version === 1 ? "Original" : `V${version}`}
                                </span>
                                {compliant !== null && (
                                  <span className={`font-semibold ${compliant ? "text-green-600" : "text-red-600"}`}>
                                    TOS {compliant ? "compliant" : "not compliant"}
                                  </span>
                                )}
                              </div>
                              {feedback && s.status === "revision_requested" && (
                                <p className="text-xs text-orange-700 mt-2 line-clamp-2 max-w-md">{feedback}</p>
                              )}
                            </td>
                            <td className="px-5 py-4 text-gray-600">
                              {s.assigned_reviewer_id
                                ? getProfileName(peopleById.get(s.assigned_reviewer_id), "—")
                                : "—"}
                            </td>
                            <td className="px-5 py-4 text-gray-500 whitespace-nowrap">
                              {formatDate(s.created_at)}
                            </td>
                            <td className="px-5 py-4">
                              <SubmissionBadge submission={s} />
                            </td>
                            <td className="px-5 py-4 text-right">
                              <Link
                                to={`/admin-dashboard/exam-reviews/${s.id}`}
                                className="inline-flex px-4 py-1.5 rounded-lg text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
                              >
                                View
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <Pager
                page={submissionPages.page}
                totalPages={submissionPages.totalPages}
                total={submissions.length}
                noun="submissions"
                onChange={submissionPages.setPage}
              />
            </>
          ))}

        {/* Peer reviews */}
        {tab === "reviews" &&
          (reviews.length === 0 ? (
            <EmptyState
              title="No Peer Reviews"
              desc="Submissions this instructor is asked to peer-review will appear here."
            />
          ) : (
            <>
              <div className={TABLE_WRAP}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className={TH_ROW}>
                        <th className="px-5 py-3.5">Exam</th>
                        <th className="px-5 py-3.5">Submitted By</th>
                        <th className="px-5 py-3.5">Assigned</th>
                        <th className="px-5 py-3.5">Reviewed</th>
                        <th className="px-5 py-3.5">Status</th>
                        <th className="px-5 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {reviewPages.items.map((r) => (
                        <tr key={r.id} className="hover:bg-brand-navy/5 transition-colors">
                          <td className="px-5 py-4 font-bold text-brand-navy">
                            {cleanTitle(r.quizzes?.title)}
                          </td>
                          <td className="px-5 py-4 text-gray-600">
                            {getProfileName(peopleById.get(r.instructor_id), "—")}
                          </td>
                          <td className="px-5 py-4 text-gray-500 whitespace-nowrap">
                            {formatDate(r.created_at)}
                          </td>
                          <td className="px-5 py-4 text-gray-500 whitespace-nowrap">
                            {r.reviewed_by === profile.id ? formatDate(r.reviewed_at) : "—"}
                          </td>
                          <td className="px-5 py-4">
                            <SubmissionBadge submission={r} />
                          </td>
                          <td className="px-5 py-4 text-right">
                            <Link
                              to={`/admin-dashboard/exam-reviews/${r.id}`}
                              className="inline-flex px-4 py-1.5 rounded-lg text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <Pager
                page={reviewPages.page}
                totalPages={reviewPages.totalPages}
                total={reviews.length}
                noun="reviews"
                onChange={reviewPages.setPage}
              />
            </>
          ))}

        {/* Recent activity */}
        {tab === "activity" && (
          <>
            <div className="flex items-center justify-between mb-3">
              <SectionTitle>
                {activity.length >= 100 ? "Last 100 Actions" : `${activity.length} Recent Actions`}
              </SectionTitle>
              <Link
                to="/admin-dashboard/audit-trail"
                className="text-xs font-semibold text-brand-gold-dark hover:text-brand-gold transition-colors rounded mb-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
              >
                Open Audit Trail
              </Link>
            </div>
            {activity.length === 0 ? (
              <EmptyState
                title="No Recorded Activity"
                desc="Exam, question and review actions by this instructor will appear here."
              />
            ) : (
              <>
              <div className={TABLE_WRAP}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className={TH_ROW}>
                        <th className="px-5 py-3.5">When</th>
                        <th className="px-5 py-3.5">Action</th>
                        <th className="px-5 py-3.5">Item</th>
                        <th className="px-5 py-3.5">Status Change</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {activityPages.items.map((log) => (
                        <tr key={log.id} className="hover:bg-brand-navy/5 transition-colors">
                          <td className="px-5 py-4 text-gray-500 whitespace-nowrap">
                            {formatDateTime(log.created_at)}
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${getActionBadgeColor(log.action)}`}
                            >
                              {formatAuditAction(log.action)}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="font-semibold text-gray-800">
                              {getAuditItemName(log) ||
                                (log.table_name === "sections" && sectionNameById.get(log.record_id)) ||
                                "—"}
                            </div>
                            <div className="text-xs text-gray-400">{formatAuditTable(log.table_name)}</div>
                          </td>
                          <td className="px-5 py-4 text-xs text-gray-600 whitespace-nowrap">
                            {log.previous_status || log.new_status ? (
                              <>
                                {log.previous_status ? formatAuditStatus(log.previous_status) : "—"}
                                <span className="text-gray-300 mx-1" aria-hidden="true">→</span>
                                {log.new_status ? formatAuditStatus(log.new_status) : "—"}
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <Pager
                page={activityPages.page}
                totalPages={activityPages.totalPages}
                total={activity.length}
                noun="actions"
                onChange={activityPages.setPage}
              />
              </>
            )}
          </>
        )}
      </div>

      {showPasswordModal && (
        <ChangePasswordModal
          target={{ id: profile.id, name }}
          onClose={() => setShowPasswordModal(false)}
        />
      )}
    </>
  );
};
