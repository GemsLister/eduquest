import React from "react";

/**
 * ExamStatusTimeline Component
 * Displays the current progress status and history log of an examination throughout its approval lifecycle.
 */
export const ExamStatusTimeline = ({ submission, historyLogs = [] }) => {
  if (!submission) return null;

  const currentStatus = submission.status;

  // Key milestones in the exam workflow
  const milestones = [
    {
      key: "created",
      title: "Quiz Created",
      description: "Initial draft & question configuration",
      isDone: true,
      activeColor: "bg-blue-600 text-white",
    },
    {
      key: "analysis",
      title: "Item Analysis Saved",
      description: "Difficulty & Bloom's classification calculated",
      isDone: Boolean(submission.analysis_results),
      activeColor: "bg-purple-600 text-white",
    },
    {
      key: "submitted",
      title: "Submitted for Review",
      description: "Forwarded to Department Head",
      isDone: ["pending", "faculty_head_review", "faculty_head_approved", "approved"].includes(currentStatus),
      activeColor: "bg-amber-600 text-white",
    },
    {
      key: "department_head_review",
      title: "Department Head Review",
      description: "Evaluation by Department Head",
      isDone: ["faculty_head_approved", "approved", "revision_requested"].includes(currentStatus),
      activeColor: currentStatus === "revision_requested" ? "bg-orange-600 text-white" : "bg-indigo-600 text-white",
    },
    {
      key: "approved",
      title: currentStatus === "revision_requested" ? "Revision Requested" : "Quiz Approved",
      description: currentStatus === "revision_requested" ? "Requires changes before publishing" : "Ready for examination use",
      isDone: ["faculty_head_approved", "approved", "revision_requested"].includes(currentStatus),
      activeColor: currentStatus === "revision_requested" ? "bg-orange-600 text-white" : "bg-green-600 text-white",
    },
  ];

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 space-y-6">
      <div className="flex items-center justify-between border-b border-gray-100 pb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 10 11-18 0 9 9 0 0118 0z" />
            </svg>
            Exam Status & Progress Tracker
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Real-time status tracking and workflow history for this examination
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
          currentStatus === "faculty_head_approved" || currentStatus === "approved"
            ? "bg-green-100 text-green-700"
            : currentStatus === "revision_requested"
            ? "bg-orange-100 text-orange-700"
            : "bg-amber-100 text-amber-700"
        }`}>
          {currentStatus === "faculty_head_approved" || currentStatus === "approved"
            ? "Fully Approved"
            : currentStatus === "revision_requested"
            ? "Revision Requested"
            : "Under Review"}
        </span>
      </div>

      {/* Visual Stepper */}
      <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4 py-2">
        {milestones.map((m, idx) => (
          <div key={m.key} className="flex-1 flex items-start md:flex-col md:items-center text-left md:text-center gap-3 md:gap-2 z-10 w-full">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-all ${
              m.isDone ? m.activeColor : "bg-gray-200 text-gray-500"
            }`}>
              {m.isDone ? "✓" : idx + 1}
            </div>
            <div>
              <div className="text-xs font-bold text-gray-800">{m.title}</div>
              <div className="text-[11px] text-gray-500 line-clamp-2">{m.description}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Audit & Event Log History */}
      {historyLogs && historyLogs.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
            Workflow Logs & Timeline History
          </h4>
          <div className="space-y-3">
            {historyLogs.map((log, idx) => (
              <div key={log.id || idx} className="flex items-start gap-3 text-xs bg-gray-50 p-3 rounded-lg border border-gray-100">
                <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center justify-between font-semibold text-gray-800">
                    <span>{log.action || log.event || "Status Change"}</span>
                    <span className="text-[11px] text-gray-400 font-mono">
                      {formatDate(log.created_at || log.timestamp)}
                    </span>
                  </div>
                  <div className="text-gray-600 mt-0.5">
                    Performed by <span className="font-medium text-gray-700">{log.profiles?.username || log.userName || log.user_role || "System"}</span>
                    {log.details && (
                      <span className="ml-1 text-gray-500">({log.details})</span>
                    )}
                  </div>
                  {log.feedback && (
                    <div className="mt-2 bg-amber-50 border-l-2 border-amber-400 p-2 text-amber-800 text-[11px] rounded">
                      <span className="font-bold">Feedback: </span>
                      {log.feedback}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
