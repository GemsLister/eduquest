// One set of labels for review-submission statuses so every page reads the same.
export const SUBMISSION_STATUS_LABELS = {
  pending: "Pending Peer Review",
  approved: "Approved",
  revision_requested: "Revision Requested",
  faculty_head_review: "Awaiting Department Head",
  faculty_head_approved: "Approved by Department Head",
};

export const SUBMISSION_STATUS_STYLES = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  revision_requested: "bg-rose-50 text-rose-700 border-rose-200",
  faculty_head_review: "bg-blue-50 text-blue-700 border-blue-200",
  faculty_head_approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export const getSubmissionStatusLabel = (status) =>
  SUBMISSION_STATUS_LABELS[status] || String(status || "Unknown").replace(/_/g, " ");

export const getSubmissionStatusStyle = (status) =>
  SUBMISSION_STATUS_STYLES[status] || "bg-slate-100 text-slate-700 border-slate-200";
