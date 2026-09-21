import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { subjectService } from "../../services/subjectService.js";

export const FacultyHeadDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);
  const [pendingSubjectRequests, setPendingSubjectRequests] = useState(0);
  const [recentSubmissions, setRecentSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      const displayName =
        user.user_metadata?.full_name || user.email?.split("@")[0] || "Department Head";
      setName(displayName);
    }
    loadStats();
  }, [user]);

  const loadStats = async () => {
    try {
      // Count pending for department head (status = 'faculty_head_review')
      const { count: pending } = await supabase
        .from("quiz_analysis_submissions")
        .select("*", { count: "exact", head: true })
        .eq("status", "faculty_head_review");

      // Count approved by department head
      const { count: approved } = await supabase
        .from("quiz_analysis_submissions")
        .select("*", { count: "exact", head: true })
        .eq("status", "faculty_head_approved");

      setPendingApprovals(pending || 0);
      setApprovedCount(approved || 0);

      // Count pending subject requests
      try {
        const { data: reqs } = await subjectService.getAllSubjectRequests();
        const pendingReqs = (reqs || []).filter(
          (r) => r.request_status === "pending"
        ).length;
        setPendingSubjectRequests(pendingReqs);
      } catch (e) {
        console.warn("Could not load subject requests count:", e);
      }

      // Recent submissions for department head
      const { data } = await supabase
        .from("quiz_analysis_submissions")
        .select("id, quiz_id, instructor_id, status, created_at, reviewed_at")
        .in("status", ["faculty_head_review", "faculty_head_approved"])
        .order("created_at", { ascending: false })
        .limit(5);

      if (data && data.length > 0) {
        const quizIds = [...new Set(data.map((s) => s.quiz_id))];
        const instructorIds = [...new Set(data.map((s) => s.instructor_id))];

        const [quizRes, profileRes] = await Promise.all([
          supabase.from("quizzes").select("id, title").in("id", quizIds),
          supabase
            .from("profiles")
            .select("id, first_name, last_name, username, email")
            .in("id", instructorIds),
        ]);

        const quizMap = new Map(
          (quizRes.data || []).map((q) => [q.id, q.title])
        );
        const profileMap = new Map(
          (profileRes.data || []).map((p) => {
            const pName = `${p.first_name || ""} ${p.last_name || ""}`.trim();
            return [p.id, pName || p.username || p.email || "Unknown"];
          })
        );

        setRecentSubmissions(
          data.map((s) => ({
            ...s,
            quizTitle: quizMap.get(s.quiz_id) || "Untitled Quiz",
            instructorName: profileMap.get(s.instructor_id) || "Unknown",
          }))
        );
      }
    } catch (err) {
      console.error("Error loading department head stats:", err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const config = {
      faculty_head_review: {
        bg: "bg-amber-50 text-amber-800 border-amber-200/80",
        label: "Pending Approval",
        dot: "bg-amber-500",
      },
      faculty_head_approved: {
        bg: "bg-emerald-50 text-emerald-800 border-emerald-200/80",
        label: "Approved",
        dot: "bg-emerald-500",
      },
    };
    const c = config[status] || {
      bg: "bg-gray-100 text-gray-700 border-gray-200",
      label: status,
      dot: "bg-gray-400",
    };
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${c.bg}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
        <span>{c.label}</span>
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

  const totalPendingActions = pendingApprovals + pendingSubjectRequests;

  return (
    <>
      {/* Hero Header Banner */}
      <div className="bg-gradient-to-r from-brand-navy to-brand-indigo px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-brand-gold text-sm font-semibold uppercase tracking-widest mb-1">
              Department Head Dashboard
            </p>
            <h1 className="text-2xl md:text-3xl font-black text-white flex flex-wrap items-center gap-3">
              {name}
              {totalPendingActions > 0 && (
                <span className="flex items-center gap-2 px-3 py-1 bg-yellow-400/20 rounded-full border border-yellow-400/30">
                  <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                  <span className="text-xs font-bold text-yellow-300">
                    {totalPendingActions} action{totalPendingActions === 1 ? "" : "s"} required
                  </span>
                </span>
              )}
            </h1>
            <p className="text-white/60 text-sm mt-1">
              Review and approve quiz analyses forwarded by Senior Faculty, and manage curriculum subjects.
            </p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Summary Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <a
            href="/faculty-head-dashboard/quiz-approvals"
            className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 flex items-center justify-between hover:border-brand-gold/40 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                  Pending Approvals
                </p>
                <p className="text-2xl font-black text-brand-navy mt-0.5">
                  {loading ? "—" : pendingApprovals}
                </p>
              </div>
            </div>
            {pendingApprovals > 0 && (
              <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold rounded-full">
                Action Needed
              </span>
            )}
          </a>

          <a
            href="/faculty-head-dashboard/subject-requests"
            className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 flex items-center justify-between hover:border-brand-gold/40 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand-navy/10 text-brand-navy flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                  Subject Requests
                </p>
                <p className="text-2xl font-black text-brand-navy mt-0.5">
                  {loading ? "—" : pendingSubjectRequests}
                </p>
              </div>
            </div>
            {pendingSubjectRequests > 0 && (
              <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold rounded-full">
                Pending Review
              </span>
            )}
          </a>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                  Total Approved
                </p>
                <p className="text-2xl font-black text-emerald-600 mt-0.5">
                  {loading ? "—" : approvedCount}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Action Cards */}
        <div className="mb-8">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => navigate("/faculty-head-dashboard/quiz-approvals")}
              className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 hover:border-brand-gold/40 hover:shadow-md transition-all text-left group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-brand-navy/10 flex items-center justify-center group-hover:bg-brand-navy group-hover:text-white transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-brand-navy group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                {pendingApprovals > 0 && (
                  <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold rounded-full">
                    {pendingApprovals} pending
                  </span>
                )}
              </div>
              <p className="font-bold text-gray-900 text-sm group-hover:text-brand-navy transition-colors">
                Review Quiz Approvals
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Evaluate and approve quizzes forwarded by the Senior Faculty.
              </p>
            </button>

            <button
              onClick={() => navigate("/faculty-head-dashboard/subject-requests")}
              className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 hover:border-brand-gold/40 hover:shadow-md transition-all text-left group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-brand-gold/20 flex items-center justify-center group-hover:bg-brand-gold group-hover:text-brand-navy transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-brand-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                {pendingSubjectRequests > 0 && (
                  <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold rounded-full">
                    {pendingSubjectRequests} pending
                  </span>
                )}
              </div>
              <p className="font-bold text-gray-900 text-sm group-hover:text-brand-navy transition-colors">
                Subject Requests Management
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Review, approve, or reject curriculum subject proposals from instructors.
              </p>
            </button>
          </div>
        </div>

        {/* Recent Submissions Feed */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
              Recent Submissions
            </h2>
            <button
              onClick={() => navigate("/faculty-head-dashboard/quiz-approvals")}
              className="text-xs font-bold text-brand-navy hover:text-brand-indigo transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>View All Submissions</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center p-12 text-center text-xs text-gray-400">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-navy mb-3"></div>
                <p>Loading recent submissions...</p>
              </div>
            ) : recentSubmissions.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="w-12 h-12 mx-auto mb-3 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <p className="text-sm font-bold text-gray-700">No Submissions Yet</p>
                <p className="text-xs text-gray-400 mt-1">
                  Submissions forwarded by Senior Faculty will appear here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {recentSubmissions.map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() =>
                      navigate(`/faculty-head-dashboard/quiz-approvals/${sub.id}`)
                    }
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50/80 transition-colors text-left cursor-pointer group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 group-hover:text-brand-navy transition-colors truncate">
                        {sub.quizTitle}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        by <strong className="text-gray-700 font-semibold">{sub.instructorName}</strong>
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {getStatusBadge(sub.status)}
                      <span className="text-xs text-gray-400 font-mono text-right hidden sm:inline-block">
                        {timeAgo(sub.created_at)}
                      </span>
                      <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-brand-navy group-hover:text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
