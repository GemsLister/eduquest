import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";

export const AdminQuizReviews = () => {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");

  useEffect(() => {
    loadSubmissions();
  }, [filter]);

  const loadSubmissions = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("quiz_analysis_submissions")
        .select("*, quizzes!inner(title, description)")
        .order("created_at", { ascending: false });

      if (filter !== "all") {
        query = query.eq("status", filter);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch instructor profiles separately
      if (data && data.length > 0) {
        const instructorIds = [...new Set(data.map((s) => s.instructor_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email, username")
          .in("id", instructorIds);

        // Map profiles to submissions
        const profileMap = {};
        profiles?.forEach((p) => {
          profileMap[p.id] = p;
        });

        const enrichedData = data.map((s) => ({
          ...s,
          profiles: profileMap[s.instructor_id] || null,
        }));

        setSubmissions(enrichedData);
      } else {
        setSubmissions(data || []);
      }
    } catch (err) {
      console.error("Error loading submissions:", err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: "bg-yellow-100 text-yellow-700 border-yellow-300",
      approved: "bg-green-100 text-green-700 border-green-300",
      revision_requested: "bg-orange-100 text-orange-700 border-orange-300",
      rejected: "bg-red-100 text-red-700 border-red-300",
    };
    const labels = {
      pending: "Pending Review",
      approved: "Approved",
      revision_requested: "Revision Requested",
      rejected: "Rejected",
    };
    return (
      <span
        className={`px-3 py-1 rounded-full text-xs font-bold border ${styles[status]}`}
      >
        {labels[status]}
      </span>
    );
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-purple-800 to-indigo-700 px-6 py-8">
        <p className="text-indigo-200 text-sm font-semibold uppercase tracking-widest mb-1">
          Admin
        </p>
        <h1 className="text-2xl md:text-3xl font-black text-white">
          Quiz Analysis Reviews
        </h1>
        <p className="text-white/60 text-sm mt-1">
          Review and approve quiz analyses submitted by instructors
        </p>
      </div>

      <div className="p-6">
        {/* Filter Tabs */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {[
            { key: "pending", label: "Pending", color: "yellow" },
            { key: "approved", label: "Approved", color: "green" },
            {
              key: "revision_requested",
              label: "Revision Requested",
              color: "orange",
            },
            { key: "rejected", label: "Rejected", color: "red" },
            { key: "all", label: "All", color: "gray" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 rounded-full font-medium transition-colors whitespace-nowrap ${
                filter === tab.key
                  ? `bg-${tab.color}-500 text-white`
                  : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
              }`}
              style={
                filter === tab.key
                  ? {
                      backgroundColor:
                        tab.color === "yellow"
                          ? "#eab308"
                          : tab.color === "green"
                            ? "#22c55e"
                            : tab.color === "orange"
                              ? "#f97316"
                              : tab.color === "red"
                                ? "#ef4444"
                                : "#6b7280",
                    }
                  : {}
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Submissions List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : submissions.length === 0 ? (
          <div className="bg-white rounded-lg p-12 text-center shadow-sm border border-gray-200">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              No Submissions Found
            </h3>
            <p className="text-gray-500">
              {filter === "pending"
                ? "No pending quiz analyses to review."
                : "No submissions match the selected filter."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {submissions.map((submission) => (
              <div
                key={submission.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-6"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-gray-800">
                        {submission.quizzes?.title || "Unknown Quiz"}
                      </h3>
                      {getStatusBadge(submission.status)}
                    </div>
                    <p className="text-sm text-gray-500 mb-2">
                      Submitted by{" "}
                      <span className="font-semibold text-gray-700">
                        {submission.profiles
                          ? `${submission.profiles.first_name || ""} ${submission.profiles.last_name || ""}`.trim() ||
                            submission.profiles.username ||
                            submission.profiles.email ||
                            "Unknown Instructor"
                          : "Unknown Instructor"}
                      </span>
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDate(submission.created_at)}
                    </p>

                    {/* Quick Stats */}
                    {submission.analysis_results?.summary && (
                      <div className="flex gap-4 mt-3">
                        <div className="flex items-center gap-1 text-sm">
                          <span className="text-gray-500">Questions:</span>
                          <span className="font-bold text-gray-800">
                            {submission.analysis_results.summary.totalQuestions}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-sm">
                          <span className="text-emerald-500">LOTS:</span>
                          <span className="font-bold text-emerald-600">
                            {submission.analysis_results.summary.lotsCount} (
                            {submission.analysis_results.summary.lotsPercentage}
                            %)
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-sm">
                          <span className="text-amber-500">HOTS:</span>
                          <span className="font-bold text-amber-600">
                            {submission.analysis_results.summary.hotsCount} (
                            {submission.analysis_results.summary.hotsPercentage}
                            %)
                          </span>
                        </div>
                        {submission.analysis_results.summary.flaggedCount >
                          0 && (
                          <div className="flex items-center gap-1 text-sm">
                            <span className="text-red-500">⚠️ Flagged:</span>
                            <span className="font-bold text-red-600">
                              {submission.analysis_results.summary.flaggedCount}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {submission.instructor_message && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-xs font-semibold text-gray-500 mb-1">
                          Instructor Note:
                        </p>
                        <p className="text-sm text-gray-700">
                          {submission.instructor_message}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        navigate(
                          `/admin-dashboard/quiz-reviews/${submission.id}`,
                        )
                      }
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors"
                    >
                      Review
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};
