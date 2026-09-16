import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient.js";
import { useAuth } from "../../context/AuthContext.jsx";

export const FacultyHeadDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);
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
          (quizRes.data || []).map((q) => [q.id, q.title]),
        );
        const profileMap = new Map(
          (profileRes.data || []).map((p) => {
            const pName = `${p.first_name || ""} ${p.last_name || ""}`.trim();
            return [p.id, pName || p.username || p.email || "Unknown"];
          }),
        );

        setRecentSubmissions(
          data.map((s) => ({
            ...s,
            quizTitle: quizMap.get(s.quiz_id) || "Untitled Quiz",
            instructorName: profileMap.get(s.instructor_id) || "Unknown",
          })),
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
      faculty_head_review: { bg: "bg-yellow-100 text-yellow-700", label: "Pending Approval" },
      faculty_head_approved: { bg: "bg-green-100 text-green-700", label: "Approved" },
    };
    const c = config[status] || { bg: "bg-gray-100 text-gray-600", label: status };
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
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <>
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-brand-navy to-brand-indigo px-6 py-8">
        <p className="text-brand-gold text-sm font-semibold uppercase tracking-widest mb-1">
          Department Head
        </p>
        <h1 className="text-2xl md:text-3xl font-black text-white">
          {name}
        </h1>
        <p className="text-white/60 text-sm mt-1">
          Review and approve quiz analyses forwarded by the Senior Faculty.
        </p>
      </div>

      <div className="p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <a
            href="/faculty-head-dashboard/quiz-approvals"
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex items-center gap-4 hover:border-brand-gold/30 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="text-3xl">📋</div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Pending Approvals</p>
              <p className="text-3xl font-black text-brand-navy">
                {loading ? "—" : pendingApprovals}
              </p>
            </div>
            {pendingApprovals > 0 && (
              <div className="ml-auto">
                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-full">
                  Action Needed
                </span>
              </div>
            )}
          </a>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex items-center gap-4">
            <div className="text-3xl">✅</div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Approved</p>
              <p className="text-3xl font-black text-green-600">
                {loading ? "—" : approvedCount}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Action */}
        <div className="mb-8">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => navigate("/faculty-head-dashboard/quiz-approvals")}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:border-brand-gold/30 hover:shadow-md transition-all text-left group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-brand-navy/10 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-brand-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                {pendingApprovals > 0 && (
                  <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-full">
                    {pendingApprovals}
                  </span>
                )}
              </div>
              <p className="font-bold text-gray-800 text-sm group-hover:text-brand-navy transition-colors">
                Review Quiz Approvals
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Approve quizzes forwarded by Senior Faculty
              </p>
            </button>
          </div>
        </div>

        {/* Recent Submissions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">
              Recent Submissions
            </h2>
            <button
              onClick={() => navigate("/faculty-head-dashboard/quiz-approvals")}
              className="text-xs font-semibold text-brand-gold-dark hover:text-brand-gold transition-colors"
            >
              View All
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-sm text-gray-400">
                Loading...
              </div>
            ) : recentSubmissions.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-14 h-14 mx-auto mb-3 bg-gray-100 rounded-xl flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-gray-600">No Submissions Yet</p>
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
                    className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {sub.quizTitle}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        by {sub.instructorName}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {getStatusBadge(sub.status)}
                      <span className="text-xs text-gray-400 w-12 text-right">
                        {timeAgo(sub.created_at)}
                      </span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
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
