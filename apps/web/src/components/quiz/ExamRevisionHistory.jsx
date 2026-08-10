import React, { useState } from "react";

/**
 * ExamRevisionHistory Component
 * Provides complete revision history and version audit trail for an examination.
 */
export const ExamRevisionHistory = ({ revisions = [], currentSubmissionId = null }) => {
  const [selectedRevision, setSelectedRevision] = useState(null);

  if (!revisions || revisions.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 text-center">
        <p className="text-sm text-gray-500">No revision history recorded for this examination.</p>
      </div>
    );
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "faculty_head_approved":
      case "approved":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">Approved</span>;
      case "revision_requested":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">Revision Requested</span>;
      case "faculty_head_review":
      case "pending":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">Pending Review</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 space-y-6">
      <div className="flex items-center justify-between border-b border-gray-100 pb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 10 11-18 0 9 9 0 0118 0z" />
            </svg>
            Exam Revision History ({revisions.length} {revisions.length === 1 ? "Version" : "Versions"})
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Transparent version audit log showing changes, feedback, and approvals over time
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {revisions.map((rev, idx) => {
          const isCurrent = rev.id === currentSubmissionId || idx === 0;
          const versionLabel = `v${revisions.length - idx}.0`;
          const analysisCount = rev.analysis_results?.analysis?.length || 0;
          const hotsCount = (rev.analysis_results?.analysis || []).filter(
            (a) => a.thinkingOrder === "HOTS" || ["Analyzing", "Evaluating", "Creating"].includes(a.level)
          ).length;

          return (
            <div
              key={rev.id || idx}
              className={`rounded-xl border p-5 transition-all ${
                isCurrent
                  ? "border-purple-300 bg-purple-50/30 shadow-sm ring-1 ring-purple-200"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-black text-purple-700 bg-purple-100 px-2.5 py-0.5 rounded">
                      {versionLabel}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] font-bold tracking-wider text-purple-600 uppercase bg-purple-100/80 px-2 py-0.5 rounded-full">
                        Current Revision
                      </span>
                    )}
                    {getStatusBadge(rev.status)}
                  </div>
                  <h4 className="text-sm font-bold text-gray-800">
                    {rev.quizzes?.title || "Exam Analysis Submission"}
                  </h4>
                  <div className="text-xs text-gray-500 flex flex-wrap items-center gap-4">
                    <span>Submitted: <strong className="text-gray-700 font-mono">{formatDate(rev.created_at)}</strong></span>
                    {rev.profiles && (
                      <span>By: <strong className="text-gray-700">{rev.profiles.first_name || ""} {rev.profiles.last_name || rev.profiles.username}</strong></span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 bg-gray-50 p-3 rounded-lg border border-gray-100 text-xs">
                  <div>
                    <div className="text-gray-400 font-medium">Questions</div>
                    <div className="font-bold text-gray-800 text-sm">{analysisCount}</div>
                  </div>
                  <div className="w-px h-8 bg-gray-200" />
                  <div>
                    <div className="text-gray-400 font-medium">HOTS Ratio</div>
                    <div className="font-bold text-indigo-600 text-sm">
                      {analysisCount > 0 ? `${Math.round((hotsCount / analysisCount) * 100)}%` : "0%"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Revision Feedback / Notes */}
              {(rev.admin_feedback || rev.notes) && (
                <div className="mt-4 p-3 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg text-xs text-amber-900">
                  <div className="font-bold mb-1 flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    Department Head / Reviewer Feedback:
                  </div>
                  <p className="whitespace-pre-wrap">{rev.admin_feedback || rev.notes}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
