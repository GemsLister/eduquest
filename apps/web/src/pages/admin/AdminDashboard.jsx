import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient.js";
import { useAdminInstructors } from "../../hooks/adminHook/useAdminInstructors.jsx";
import {
  BloomsDistributionChart,
  LotsHotsBar,
} from "../../components/BloomsVisualization";

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const { instructors, loading } = useAdminInstructors();
  const [adminName, setAdminName] = useState("");
  const [pendingReviews, setPendingReviews] = useState(0);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [bloomsStats, setBloomsStats] = useState(null);
  const [bloomsLoading, setBloomsLoading] = useState(true);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [recentSubmissions, setRecentSubmissions] = useState([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [tosCompliance, setTosCompliance] = useState(null);

  useEffect(() => {
    const getAdmin = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const name =
          user.user_metadata?.full_name || user.email?.split("@")[0] || "Admin";
        setAdminName(name);
      }
    };
    getAdmin();
    loadPendingReviews();
    loadBloomsStats();
    loadPendingRequests();
    loadRecentSubmissions();
  }, []);

  const loadPendingReviews = async () => {
    try {
      const { count, error } = await supabase
        .from("quiz_analysis_submissions")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      if (!error) {
        setPendingReviews(count || 0);
      }
    } catch (err) {
      console.error("Error loading pending reviews:", err);
    } finally {
      setReviewsLoading(false);
    }
  };

  const loadBloomsStats = async () => {
    setBloomsLoading(true);
    try {
      const { data, error } = await supabase
        .from("quiz_analysis_submissions")
        .select("status, analysis_results");

      if (error) throw error;

      const submissions = data || [];
      const total = submissions.length;
      const approved = submissions.filter((s) => s.status === "approved").length;
      const rejected = submissions.filter((s) => s.status === "rejected").length;
      const revisionRequested = submissions.filter(
        (s) => s.status === "revision_requested",
      ).length;
      const reviewed = approved + rejected + revisionRequested;
      const revisionRate =
        reviewed > 0 ? Math.round((revisionRequested / reviewed) * 100) : 0;
      const approvalRate =
        reviewed > 0 ? Math.round((approved / reviewed) * 100) : 0;

      // Aggregate Bloom's distribution across all submissions
      let totalLots = 0;
      let totalHots = 0;
      const aggDistribution = {
        Remembering: 0,
        Understanding: 0,
        Applying: 0,
        Analyzing: 0,
        Evaluating: 0,
        Creating: 0,
      };

      submissions.forEach((s) => {
        const summary = s.analysis_results?.summary;
        if (summary) {
          totalLots += summary.lotsCount || 0;
          totalHots += summary.hotsCount || 0;
          if (summary.distribution) {
            Object.entries(summary.distribution).forEach(([level, count]) => {
              if (aggDistribution[level] !== undefined) {
                aggDistribution[level] += count;
              }
            });
          }
        }
      });

      const totalQuestions = totalLots + totalHots;
      const lotsPercentage =
        totalQuestions > 0 ? Math.round((totalLots / totalQuestions) * 100) : 0;
      const hotsPercentage =
        totalQuestions > 0 ? Math.round((totalHots / totalQuestions) * 100) : 0;

      setBloomsStats({
        total,
        approved,
        rejected,
        revisionRequested,
        reviewed,
        revisionRate,
        approvalRate,
        totalQuestions,
        totalLots,
        totalHots,
        lotsPercentage,
        hotsPercentage,
        aggDistribution,
      });
    } catch (err) {
      console.error("Error loading Bloom's stats:", err);
    } finally {
      setBloomsLoading(false);
    }
  };

  const loadPendingRequests = async () => {
    try {
      const { count, error } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("is_approved", false)
        .eq("is_admin", false);

      if (!error) setPendingRequests(count || 0);
    } catch (err) {
      console.error("Error loading pending requests:", err);
    }
  };

  const loadRecentSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from("quiz_analysis_submissions")
        .select("id, quiz_id, instructor_id, status, created_at, updated_at")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;

      const submissions = data || [];
      if (submissions.length === 0) {
        setRecentSubmissions([]);
        setRecentLoading(false);
        return;
      }

      const quizIds = [...new Set(submissions.map((s) => s.quiz_id))];
      const instructorIds = [...new Set(submissions.map((s) => s.instructor_id))];

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
          const name = `${p.first_name || ""} ${p.last_name || ""}`.trim();
          return [p.id, name || p.username || p.email || "Unknown"];
        }),
      );

      const enriched = submissions.map((s) => ({
        ...s,
        quizTitle: quizMap.get(s.quiz_id) || "Untitled Quiz",
        instructorName: profileMap.get(s.instructor_id) || "Unknown",
      }));

      setRecentSubmissions(enriched);

      // TOS compliance calculation from approved submissions
      const { data: approvedData } = await supabase
        .from("quiz_analysis_submissions")
        .select("analysis_results")
        .eq("status", "approved");

      if (approvedData && approvedData.length > 0) {
        let compliant = 0;
        let nonCompliant = 0;
        approvedData.forEach((s) => {
          const summary = s.analysis_results?.summary;
          if (summary) {
            const lotsPct = summary.lotsPercentage || 0;
            const hotsPct = summary.hotsPercentage || 0;
            if (Math.abs(lotsPct - 30) <= 5 && Math.abs(hotsPct - 70) <= 5) {
              compliant++;
            } else {
              nonCompliant++;
            }
          }
        });
        setTosCompliance({ compliant, nonCompliant, total: compliant + nonCompliant });
      }
    } catch (err) {
      console.error("Error loading recent submissions:", err);
    } finally {
      setRecentLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: "bg-yellow-100 text-yellow-700",
      approved: "bg-green-100 text-green-700",
      rejected: "bg-red-100 text-red-700",
      revision_requested: "bg-orange-100 text-orange-700",
    };
    const labels = {
      pending: "Pending",
      approved: "Approved",
      rejected: "Rejected",
      revision_requested: "Revision",
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${styles[status] || "bg-gray-100 text-gray-600"}`}>
        {labels[status] || status}
      </span>
    );
  };

  const timeAgo = (dateStr) => {
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
          Admin
        </p>
        <h1 className="text-2xl md:text-3xl font-black text-white">
          Welcome back, {adminName}
        </h1>
        <p className="text-white/60 text-sm mt-1">
          Manage instructor accounts and system settings here.
        </p>
      </div>

      {/* Stats */}
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex items-center gap-4">
            <div className="text-3xl">👥</div>
            <div>
              <p className="text-sm text-gray-500 font-medium">
                Total Instructors
              </p>
              <p className="text-3xl font-black text-brand-navy">
                {loading ? "—" : instructors.length}
              </p>
            </div>
          </div>

          <a
            href="/admin-dashboard/quiz-reviews"
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex items-center gap-4 hover:border-brand-gold/30 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="text-3xl">🧠</div>
            <div>
              <p className="text-sm text-gray-500 font-medium">
                Pending Reviews
              </p>
              <p className="text-3xl font-black text-brand-navy">
                {reviewsLoading ? "—" : pendingReviews}
              </p>
            </div>
            {pendingReviews > 0 && (
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
              <p className="text-sm text-gray-500 font-medium">Approved</p>
              <p className="text-3xl font-black text-green-600">
                {bloomsLoading ? "—" : bloomsStats?.approved || 0}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex items-center gap-4">
            <div className="text-3xl">❌</div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Rejected</p>
              <p className="text-3xl font-black text-red-600">
                {bloomsLoading ? "—" : bloomsStats?.rejected || 0}
              </p>
            </div>
          </div>
        </div>

        {/* Bloom's Analytics Section */}
        {!bloomsLoading && bloomsStats && bloomsStats.total > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3">
              Bloom's Taxonomy Analytics
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Review Stats */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h3 className="text-sm font-bold text-gray-700 mb-4">
                  Review Overview
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">
                      Total Submissions
                    </span>
                    <span className="text-lg font-bold text-gray-800">
                      {bloomsStats.total}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Approval Rate</span>
                    <span className="text-lg font-bold text-green-600">
                      {bloomsStats.approvalRate}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Revision Rate</span>
                    <span className="text-lg font-bold text-orange-600">
                      {bloomsStats.revisionRate}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">
                      Total Questions Analyzed
                    </span>
                    <span className="text-lg font-bold text-brand-navy">
                      {bloomsStats.totalQuestions}
                    </span>
                  </div>

                  {/* Status breakdown bar */}
                  <div className="pt-2">
                    <p className="text-xs text-gray-400 mb-2">
                      Status Breakdown
                    </p>
                    <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
                      {bloomsStats.approved > 0 && (
                        <div
                          className="bg-green-500"
                          style={{
                            width: `${(bloomsStats.approved / bloomsStats.total) * 100}%`,
                          }}
                          title={`Approved: ${bloomsStats.approved}`}
                        />
                      )}
                      {pendingReviews > 0 && (
                        <div
                          className="bg-yellow-400"
                          style={{
                            width: `${(pendingReviews / bloomsStats.total) * 100}%`,
                          }}
                          title={`Pending: ${pendingReviews}`}
                        />
                      )}
                      {bloomsStats.revisionRequested > 0 && (
                        <div
                          className="bg-orange-500"
                          style={{
                            width: `${(bloomsStats.revisionRequested / bloomsStats.total) * 100}%`,
                          }}
                          title={`Revision: ${bloomsStats.revisionRequested}`}
                        />
                      )}
                      {bloomsStats.rejected > 0 && (
                        <div
                          className="bg-red-500"
                          style={{
                            width: `${(bloomsStats.rejected / bloomsStats.total) * 100}%`,
                          }}
                          title={`Rejected: ${bloomsStats.rejected}`}
                        />
                      )}
                    </div>
                    <div className="flex gap-3 mt-2 text-[10px] text-gray-400">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        Approved
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-yellow-400" />
                        Pending
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-orange-500" />
                        Revision
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        Rejected
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* LOTS vs HOTS */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h3 className="text-sm font-bold text-gray-700 mb-4">
                  Aggregate LOTS vs HOTS
                </h3>
                <div className="mb-6">
                  <LotsHotsBar
                    lotsCount={bloomsStats.totalLots}
                    hotsCount={bloomsStats.totalHots}
                    lotsPercentage={bloomsStats.lotsPercentage}
                    hotsPercentage={bloomsStats.hotsPercentage}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-brand-navy/5 rounded-lg p-3">
                    <p className="text-2xl font-black text-brand-navy">
                      {bloomsStats.totalLots}
                    </p>
                    <p className="text-xs text-brand-navy font-medium">
                      LOTS Questions
                    </p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3">
                    <p className="text-2xl font-black text-amber-600">
                      {bloomsStats.totalHots}
                    </p>
                    <p className="text-xs text-amber-500 font-medium">
                      HOTS Questions
                    </p>
                  </div>
                </div>
              </div>

              {/* Distribution Chart */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h3 className="text-sm font-bold text-gray-700 mb-2">
                  Aggregate Bloom's Distribution
                </h3>
                <BloomsDistributionChart
                  distribution={bloomsStats.aggDistribution}
                  size="sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-8">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => navigate("/admin-dashboard/quiz-reviews")}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:border-brand-gold/30 hover:shadow-md transition-all text-left group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-brand-navy/10 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-brand-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                {pendingReviews > 0 && (
                  <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-full">
                    {pendingReviews}
                  </span>
                )}
              </div>
              <p className="font-bold text-gray-800 text-sm group-hover:text-brand-navy transition-colors">
                Review Submissions
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Review pending quiz analyses
              </p>
            </button>

            <button
              onClick={() => navigate("/admin-dashboard/registration-requests")}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:border-brand-gold/30 hover:shadow-md transition-all text-left group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </div>
                {pendingRequests > 0 && (
                  <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded-full">
                    {pendingRequests}
                  </span>
                )}
              </div>
              <p className="font-bold text-gray-800 text-sm group-hover:text-brand-navy transition-colors">
                Registration Requests
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Approve new instructor accounts
              </p>
            </button>

            <button
              onClick={() => navigate("/admin-dashboard/instructors")}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:border-brand-gold/30 hover:shadow-md transition-all text-left group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-brand-navy/10 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-brand-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              </div>
              <p className="font-bold text-gray-800 text-sm group-hover:text-brand-navy transition-colors">
                Manage Instructors
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                View and manage instructor accounts
              </p>
            </button>

            <button
              onClick={() => navigate("/admin-dashboard/create-instructor")}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:border-brand-gold/30 hover:shadow-md transition-all text-left group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-brand-gold/15 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-brand-gold-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
              </div>
              <p className="font-bold text-gray-800 text-sm group-hover:text-brand-gold-dark transition-colors">
                Create Instructor
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Add a new instructor account
              </p>
            </button>
          </div>
        </div>

        {/* TOS Compliance Overview + Recent Submissions — side by side */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* TOS Compliance Overview */}
          <div>
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3">
              TOS Compliance Overview
            </h2>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              {tosCompliance && tosCompliance.total > 0 ? (
                <>
                  {/* Donut-style visual */}
                  <div className="flex items-center gap-6 mb-5">
                    <div className="relative w-28 h-28 shrink-0">
                      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                        <circle
                          cx="18" cy="18" r="15.915"
                          fill="none" stroke="#f3f4f6" strokeWidth="3"
                        />
                        <circle
                          cx="18" cy="18" r="15.915"
                          fill="none"
                          stroke="#22c55e"
                          strokeWidth="3"
                          strokeDasharray={`${(tosCompliance.compliant / tosCompliance.total) * 100} ${100 - (tosCompliance.compliant / tosCompliance.total) * 100}`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xl font-black text-gray-800">
                          {Math.round((tosCompliance.compliant / tosCompliance.total) * 100)}%
                        </span>
                        <span className="text-[10px] text-gray-400 font-medium">Compliant</span>
                      </div>
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-green-500" />
                          <span className="text-sm text-gray-600">Compliant</span>
                        </div>
                        <span className="text-sm font-bold text-green-600">
                          {tosCompliance.compliant} quizzes
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-500" />
                          <span className="text-sm text-gray-600">Non-Compliant</span>
                        </div>
                        <span className="text-sm font-bold text-red-600">
                          {tosCompliance.nonCompliant} quizzes
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <span className="text-sm text-gray-500">Total Approved</span>
                        <span className="text-sm font-bold text-gray-700">
                          {tosCompliance.total} quizzes
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">
                      School TOS requires <span className="font-semibold text-gray-700">30% LOTS / 70% HOTS</span> distribution with 5% tolerance. Quizzes outside this range are flagged as non-compliant.
                    </p>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <div className="w-14 h-14 mx-auto mb-3 bg-gray-100 rounded-xl flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-gray-600">No Compliance Data Yet</p>
                  <p className="text-xs text-gray-400 mt-1">
                    TOS compliance will appear once quizzes are approved.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Submissions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">
                Recent Submissions
              </h2>
              <button
                onClick={() => navigate("/admin-dashboard/quiz-reviews")}
                className="text-xs font-semibold text-brand-gold-dark hover:text-brand-gold transition-colors"
              >
                View All
              </button>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {recentLoading ? (
                <div className="p-8 text-center text-sm text-gray-400">
                  Loading recent submissions...
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
                    Submissions will appear here when instructors submit quizzes for review.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {recentSubmissions.map((sub) => (
                    <button
                      key={sub.id}
                      onClick={() =>
                        navigate(`/admin-dashboard/quiz-reviews/${sub.id}`)
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

      </div>
    </>
  );
};
