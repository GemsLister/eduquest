/**
 * Human-readable formatting for audit_trail rows.
 * Turns action keys, role keys, status codes, and raw JSON payloads into
 * labels a Department Head can read without knowing the database schema.
 */

const ACTION_LABELS = {
  SUBMITTED_FOR_REVIEW: "Submitted for Review",
  RESUBMITTED_FOR_REVIEW: "Resubmitted for Review",
  PEER_REVIEW_FORWARDED_TO_HEAD: "Peer Reviewer Forwarded to Head",
  PEER_REVIEW_REVISION_REQUESTED: "Peer Reviewer Requested Revision",
  FORWARDED_TO_HEAD: "Senior Faculty Forwarded to Head",
  REVISION_REQUESTED: "Revision Requested",
  QUIZ_APPROVED: "Exam Approved",
  REVISION_CREATED: "Revision Created",
  QUIZ_CREATED: "Exam Created",
  QUIZ_PUBLISHED: "Exam Published",
  QUIZ_UPDATED: "Exam Updated",
  QUIZ_DELETED: "Exam Deleted",
  QUESTIONS_CREATED: "Questions Created",
  QUESTION_UPDATED: "Question Updated",
  QUESTION_DELETED: "Question Deleted",
  QUESTION_ADDED_TO_BANK: "Question Added to Bank",
  SECTION_CREATED: "Section Created",
  SECTION_UPDATED: "Section Updated",
  SECTION_ARCHIVED: "Section Archived",
  ANALYSIS_SAVED: "Item Analysis Saved",
  USER_LOGIN: "User Login",
  INSTRUCTOR_CREATED: "Instructor Account Created",
  REGISTRATION_APPROVED: "Registration Approved",
  REGISTRATION_REJECTED: "Registration Rejected",
  ACCOUNT_DISABLED: "Account Disabled",
  ACCOUNT_ENABLED: "Account Enabled",
  PASSWORD_RESET: "Instructor Password Reset",
};

export const AUDIT_ACTION_OPTIONS = Object.entries(ACTION_LABELS).map(
  ([value, label]) => ({ value, label }),
);

export const AUDIT_TABLE_OPTIONS = [
  { value: "quizzes", label: "Exams" },
  { value: "questions", label: "Questions" },
  { value: "sections", label: "Sections" },
  { value: "item_analysis", label: "Item Analysis" },
  { value: "profiles", label: "Accounts" },
];

const titleCase = (key) =>
  String(key || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

// Badge colors per action, shared by every audit list
export const getActionBadgeColor = (action) => {
  switch ((action || "").toUpperCase()) {
    case "QUIZ_CREATED":
    case "QUIZ_PUBLISHED":
      return "bg-blue-50 text-blue-800 border border-blue-200/80";
    case "SUBMITTED_FOR_REVIEW":
    case "RESUBMITTED_FOR_REVIEW":
      return "bg-amber-50 text-amber-800 border border-amber-200/80";
    case "FORWARDED_TO_HEAD":
    case "PEER_REVIEW_FORWARDED_TO_HEAD":
      return "bg-sky-50 text-sky-800 border border-sky-200/80";
    case "QUIZ_APPROVED":
      return "bg-emerald-50 text-emerald-800 border border-emerald-200/80";
    case "REVISION_REQUESTED":
    case "PEER_REVIEW_REVISION_REQUESTED":
      return "bg-orange-50 text-orange-800 border border-orange-200/80";
    case "QUIZ_UPDATED":
    case "QUESTION_UPDATED":
    case "SECTION_UPDATED":
      return "bg-indigo-50 text-indigo-800 border border-indigo-200/80";
    case "QUIZ_DELETED":
    case "QUESTION_DELETED":
    case "SECTION_ARCHIVED":
      return "bg-rose-50 text-rose-800 border border-rose-200/80";
    case "ANALYSIS_SAVED":
      return "bg-purple-50 text-purple-800 border border-purple-200/80";
    case "INSTRUCTOR_CREATED":
    case "REGISTRATION_APPROVED":
    case "ACCOUNT_ENABLED":
      return "bg-teal-50 text-teal-800 border border-teal-200/80";
    case "REGISTRATION_REJECTED":
    case "ACCOUNT_DISABLED":
      return "bg-rose-50 text-rose-800 border border-rose-200/80";
    case "PASSWORD_RESET":
      return "bg-indigo-50 text-indigo-800 border border-indigo-200/80";
    default:
      return "bg-slate-100 text-slate-700 border border-slate-200";
  }
};

export const formatAuditAction = (action) =>
  ACTION_LABELS[(action || "").toUpperCase()] || titleCase(action) || "Activity";

export const formatAuditTable = (tableName) =>
  AUDIT_TABLE_OPTIONS.find((t) => t.value === tableName)?.label ||
  titleCase(tableName) ||
  "—";

const ROLE_LABELS = {
  admin: "Senior Faculty",
  senior_faculty: "Senior Faculty",
  faculty_head: "Department Head",
  peer_reviewer: "Peer Reviewer",
  instructor: "Instructor",
  teacher: "Instructor",
};

export const formatAuditRole = (role) =>
  ROLE_LABELS[(role || "").toLowerCase()] || titleCase(role) || "—";

const STATUS_LABELS = {
  draft: "Draft",
  published: "Published",
  pending: "Pending Review",
  submitted_for_review: "Submitted for Review",
  approved: "Reviewed",
  forwarded_to_head: "Forwarded to Department Head",
  faculty_head_review: "Awaiting Department Head",
  faculty_head_approved: "Approved by Department Head",
  revision_requested: "Revision Requested",
  rejected: "Returned",
};

export const formatAuditStatus = (status) =>
  STATUS_LABELS[(status || "").toLowerCase()] || titleCase(status);

const STATUS_TONES = {
  faculty_head_approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  published: "bg-emerald-50 text-emerald-700 border-emerald-200",
  revision_requested: "bg-orange-50 text-orange-700 border-orange-200",
  rejected: "bg-orange-50 text-orange-700 border-orange-200",
  faculty_head_review: "bg-sky-50 text-sky-700 border-sky-200",
  forwarded_to_head: "bg-sky-50 text-sky-700 border-sky-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  submitted_for_review: "bg-amber-50 text-amber-700 border-amber-200",
};

export const getAuditStatusTone = (status) =>
  STATUS_TONES[(status || "").toLowerCase()] ||
  "bg-slate-50 text-slate-700 border-slate-200";

// Keys that hold raw identifiers. They are resolved to names/links instead
// of being printed.
const ID_KEYS = new Set([
  "id",
  "submissionId",
  "submission_id",
  "instructorId",
  "instructor_id",
  "quizId",
  "quiz_id",
  "parentQuizId",
  "parent_quiz_id",
  "sectionId",
  "section_id",
  "userId",
  "user_id",
]);

// Keys already shown elsewhere on the card.
const PROMOTED_KEYS = new Set(["quizTitle", "status", "feedback"]);

const FIELD_LABELS = {
  count: "Count",
  versionNumber: "Version",
  revisedQuestionsCount: "Revised Questions",
  question_text: "Question",
  updated_fields: "Updated Fields",
  name: "Name",
  description: "Description",
};

const formatValue = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map((v) => titleCase(v)).join(", ") || "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

/**
 * Readable key/value pairs from a JSON payload (new_values / old_values),
 * with raw identifiers removed.
 */
export const getReadableFields = (values) => {
  if (!values || typeof values !== "object") return [];
  return Object.entries(values)
    .filter(([key]) => !ID_KEYS.has(key) && !PROMOTED_KEYS.has(key))
    .map(([key, value]) => ({
      key,
      label: FIELD_LABELS[key] || titleCase(key),
      value: formatValue(value),
    }));
};

/** Before → after pairs for fields present in old_values. */
export const getChangedFields = (oldValues, newValues) => {
  if (!oldValues || typeof oldValues !== "object") return [];
  return Object.keys(oldValues)
    .filter((key) => !ID_KEYS.has(key))
    .map((key) => ({
      key,
      label: FIELD_LABELS[key] || titleCase(key),
      before: formatValue(oldValues[key]),
      after: formatValue(newValues?.[key]),
    }))
    .filter((f) => f.before !== f.after);
};

/** IDs inside a log's payload that should be resolved to profile names. */
export const getReferencedUserIds = (log) => {
  const v = log?.new_values || {};
  return [v.instructorId, v.instructor_id].filter(Boolean);
};

export const getAuditSubmissionId = (log) =>
  log?.new_values?.submissionId || log?.new_values?.submission_id || null;

export const getAuditStatus = (log) =>
  log?.new_status || log?.new_values?.status || null;

export const getAuditFeedback = (log) =>
  log?.reason || log?.new_values?.feedback || null;

export const getAuditItemName = (log) =>
  log?.item_name || log?.new_values?.quizTitle || log?.quiz?.title || null;
