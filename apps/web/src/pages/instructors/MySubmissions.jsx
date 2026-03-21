import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { BloomsVisualizationPanel } from "../../components/BloomsVisualization";

export const MySubmissions = () => {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    loadSubmissions();
  }, [filter]);

  const loadSubmissions = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from("quiz_analysis_submissions")
        .select("*, quizzes(title, description)")
        .eq("instructor_id", user.id)
        .order("created_at", { ascending: false });

      if (filter !== "all") {
        query = query.eq("status", filter);
      }

      const { data, error } = await query;
      if (error) throw error;

      setSubmissions(data || []);
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

  const getStatusIcon = (status) => {
    switch (status) {
      case "pending":
        return "🕐";
      case "approved":
        return "✅";
      case "revision_requested":
        return "⚠️";
      case "rejected":
        return "❌";
      default:
        return "📋";
    }
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
      <div className="bg-gradient-to-r from-hornblende-green via-emerald-700 to-hornblende-green px-6 py-8">
        <p className="text-emerald-200 text-sm font-semibold uppercase tracking-widest mb-1">
          My Submissions
        </p>
        <h1 className="text-2xl md:text-3xl font-black text-white">
          Quiz Analysis Submissions
        </h1>
        <p className="text-white/60 text-sm mt-1">
          Track the status of your forwarded quiz analyses
        </p>
      </div>

      <div className="p-6">
        {/* Filter Tabs */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {[
            { key: "all", label: "All" },
            { key: "pending", label: "Pending" },
            { key: "approved", label: "Approved" },
            { key: "revision_requested", label: "Needs Revision" },
            { key: "rejected", label: "Rejected" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 rounded-full font-medium transition-colors whitespace-nowrap text-sm ${
                filter === tab.key
                  ? "bg-hornblende-green text-white"
                  : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Submissions List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-hornblende-green"></div>
          </div>
        ) : submissions.length === 0 ? (
          <div className="bg-white rounded-lg p-12 text-center shadow-sm border border-gray-200">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              No Submissions Found
            </h3>
            <p className="text-gray-500">
              {filter === "all"
                ? "You haven't submitted any quiz analyses yet. Analyze a quiz and forward it to the admin for review."
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
                <div className="flex flex-col gap-4">
                  {/* Title and Status */}
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {getStatusIcon(submission.status)}
                    </span>
                    <h3 className="text-lg font-bold text-gray-800 flex-1">
                      {submission.quizzes?.title || "Unknown Quiz"}
                    </h3>
                    {getStatusBadge(submission.status)}
                  </div>

                  {/* Quick Stats */}
                  {submission.analysis_results?.summary && (
                    <div className="flex gap-4">
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
                          {submission.analysis_results.summary.lotsPercentage}%)
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        <span className="text-amber-500">HOTS:</span>
                        <span className="font-bold text-amber-600">
                          {submission.analysis_results.summary.hotsCount} (
                          {submission.analysis_results.summary.hotsPercentage}%)
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Instructor Message */}
                  {submission.instructor_message && (
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-xs font-semibold text-blue-600 mb-1">
                        Your Note:
                      </p>
                      <p className="text-sm text-blue-800">
                        {submission.instructor_message}
                      </p>
                    </div>
                  )}

                  {/* Admin Feedback */}
                  {submission.admin_feedback && (
                    <div
                      className={`p-3 rounded-lg border ${
                        submission.status === "approved"
                          ? "bg-green-50 border-green-200"
                          : submission.status === "rejected"
                            ? "bg-red-50 border-red-200"
                            : "bg-orange-50 border-orange-200"
                      }`}
                    >
                      <p
                        className={`text-xs font-semibold mb-1 ${
                          submission.status === "approved"
                            ? "text-green-600"
                            : submission.status === "rejected"
                              ? "text-red-600"
                              : "text-orange-600"
                        }`}
                      >
                        Admin Feedback:
                      </p>
                      <p
                        className={`text-sm ${
                          submission.status === "approved"
                            ? "text-green-800"
                            : submission.status === "rejected"
                              ? "text-red-800"
                              : "text-orange-800"
                        }`}
                      >
                        {submission.admin_feedback}
                      </p>
                    </div>
                  )}

                  {/* Expandable Charts */}
                  {submission.analysis_results?.summary && (
                    <div>
                      <button
                        onClick={() =>
                          setExpandedId(
                            expandedId === submission.id
                              ? null
                              : submission.id,
                          )
                        }
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1"
                      >
                        <span
                          className={`transition-transform duration-200 inline-block ${
                            expandedId === submission.id
                              ? "rotate-90"
                              : ""
                          }`}
                        >
                          ▶
                        </span>
                        {expandedId === submission.id
                          ? "Hide Charts"
                          : "View Charts"}
                      </button>
                      {expandedId === submission.id && (
                        <div className="mt-3">
                          <BloomsVisualizationPanel
                            summary={submission.analysis_results.summary}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-100">
                    <span>Submitted {formatDate(submission.created_at)}</span>
                    <div className="flex items-center gap-3">
                      {submission.reviewed_at && (
                        <span>
                          Reviewed {formatDate(submission.reviewed_at)}
                        </span>
                      )}
                      {submission.status === "revision_requested" && (
                        <button
                          onClick={() =>
                            navigate(
                              `/instructor-dashboard/instructor-quiz/${submission.quiz_id}`,
                            )
                          }
                          className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-colors"
                        >
                          Edit & Resubmit
                        </button>
                      )}
                    </div>
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
