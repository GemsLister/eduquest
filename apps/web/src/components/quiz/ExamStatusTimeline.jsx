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
      activeColor: "bg-brand-navy text-white",
    },
    {
      key: "analysis",
      title: "Item Analysis Saved",
      description: "Difficulty & Bloom's classification calculated",
      isDone: Boolean(submission.analysis_results),
      activeColor: "bg-brand-navy text-white",
    },
    {
      key: "submitted",
      title: "Submitted for Review",
      description: "Forwarded to Department Head",
      isDone: ["pending", "faculty_head_review", "faculty_head_approved", "approved"].includes(currentStatus),
      activeColor: "bg-brand-navy text-white",
    },
    {
      key: "department_head_review",
      title: "Department Head Review",
      description: "Evaluation by Department Head",
      isDone: ["faculty_head_approved", "approved", "revision_requested"].includes(currentStatus),
      activeColor: currentStatus === "revision_requested" ? "bg-orange-600 text-white" : "bg-brand-navy text-white",
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
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <div>
          <h3 className="text-sm font-bold text-gray-800">Exam Lifecycle & Process Audit Trail</h3>
          <p className="text-xs text-gray-500">Real-time status tracking and reviewer checkpoint timeline</p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
          currentStatus === "approved" || currentStatus === "faculty_head_approved"
            ? "bg-green-100 text-green-700"
            : currentStatus === "revision_requested"
            ? "bg-orange-100 text-orange-700"
            : "bg-brand-navy/10 text-brand-navy"
        }`}>
          {currentStatus === "approved" || currentStatus === "faculty_head_approved"
            ? "Approved"
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
              {m.isDone ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                idx + 1
              )}
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
                <div className="w-2 h-2 rounded-full bg-brand-navy mt-1.5 shrink-0" />
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
