import { supabase } from "../supabaseClient.js";
import { exportBloomsPdf } from "../utils/exportBloomsPdf.js";
import { exportQuizPaperPdf } from "../utils/exportQuizPaperPdf.js";

/**
 * Department Head data helpers shared by the dashboard, sidebar badge,
 * Quiz Approvals list and Approval Detail page so they all agree on what
 * "pending", "approved" and "returned" mean.
 */

export const HEAD_STATUSES = {
  PENDING: "faculty_head_review",
  APPROVED: "faculty_head_approved",
  RETURNED: "revision_requested",
};

export const cleanQuizTitle = (title) =>
  (title || "Untitled Exam").replace(/\s*\(Revised(?:\s+\d+)?\)\s*$/i, "");

export const getProfileName = (p, fallback = "Unknown") => {
  if (!p) return fallback;
  return (
    `${p.first_name || ""} ${p.last_name || ""}`.trim() ||
    p.username ||
    p.email ||
    fallback
  );
};

/** A revision request that came from the Department Head (not a reviewer). */
export const isReturnedByHead = (s) =>
  s.status === HEAD_STATUSES.RETURNED &&
  !!(s.faculty_head_feedback || s.faculty_head_reviewed_by);

const isHeadRelevant = (s) =>
  s.status === HEAD_STATUSES.PENDING ||
  s.status === HEAD_STATUSES.APPROVED ||
  isReturnedByHead(s);

/**
 * Load the submissions the Department Head acts on, one per quiz revision
 * chain (the latest head-relevant submission in each chain).
 *
 * @param {object} [options]
 * @param {boolean} [options.enrich=true] attach instructor/reviewer profiles and section
 */
export const loadHeadSubmissions = async ({ enrich = true } = {}) => {
  const { data, error } = await supabase
    .from("quiz_analysis_submissions")
    .select("*, quizzes(title, description, duration, parent_quiz_id)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  const all = data || [];

  // Resolve each quiz to the root of its revision chain
  const parentOf = new Map();
  all.forEach((s) => {
    if (s.quiz_id) parentOf.set(s.quiz_id, s.quizzes?.parent_quiz_id || null);
  });
  const findRootId = (quizId) => {
    let curr = quizId;
    const visited = new Set();
    while (curr && parentOf.get(curr) && !visited.has(curr)) {
      visited.add(curr);
      curr = parentOf.get(curr);
    }
    return curr;
  };
  const chainKey = (s) => {
    const root = findRootId(s.quiz_id);
    if (root) return `quiz_${root}`;
    return `sub_${s.id}`;
  };

  const chains = new Map();
  all.forEach((s) => {
    const key = chainKey(s);
    if (!chains.has(key)) chains.set(key, []);
    chains.get(key).push(s); // already newest first
  });

  const visible = [];
  for (const chainSubs of chains.values()) {
    const latestRelevant = chainSubs.find(isHeadRelevant);
    if (!latestRelevant) continue;
    const latestOverall = chainSubs[0];
    const resubmitted =
      isReturnedByHead(latestRelevant) && latestOverall.id !== latestRelevant.id;
    visible.push({
      ...latestRelevant,
      resubmitted,
      resubmittedStatus: resubmitted ? latestOverall.status : null,
    });
  }

  visible.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  if (!enrich || visible.length === 0) return visible;

  const profileIds = [
    ...new Set(
      visible
        .flatMap((s) => [s.instructor_id, s.reviewed_by, s.assigned_reviewer_id])
        .filter(Boolean),
    ),
  ];
  const quizIds = [...new Set(visible.map((s) => s.quiz_id).filter(Boolean))];

  const [profilesRes, sectionsRes] = await Promise.all([
    profileIds.length
      ? supabase
          .from("profiles")
          .select("id, first_name, last_name, email, username, is_admin, avatar_url")
          .in("id", profileIds)
      : Promise.resolve({ data: [] }),
    quizIds.length
      ? supabase
          .from("quiz_sections")
          .select("quiz_id, sections(name, subject_code, subjects(code, name))")
          .in("quiz_id", quizIds)
      : Promise.resolve({ data: [] }),
  ]);

  const profileMap = new Map((profilesRes.data || []).map((p) => [p.id, p]));
  const sectionMap = new Map();
  (sectionsRes.data || []).forEach((row) => {
    if (!sectionMap.has(row.quiz_id) && row.sections) {
      sectionMap.set(row.quiz_id, row.sections);
    }
  });

  return visible.map((s) => ({
    ...s,
    profiles: profileMap.get(s.instructor_id) || null,
    reviewer:
      profileMap.get(s.reviewed_by) || profileMap.get(s.assigned_reviewer_id) || null,
    section: sectionMap.get(s.quiz_id) || null,
  }));
};

const isMissingColumnError = (error) =>
  !!error &&
  (error.code === "PGRST204" ||
    error.code === "42703" ||
    /column .* (does not exist|could not find)|could not find the .* column/i.test(
      error.message || "",
    ));

/**
 * Update a submission with the Department Head columns added in
 * 20261020_add_faculty_head_feedback.sql (and the per-question column from
 * 20261025_add_faculty_head_question_feedback.sql, passed as
 * `questionFields`). Each missing migration drops back one step so the action
 * still goes through: without the per-question column the comments are
 * folded into `legacyQuestionHeadFields`; without any head column,
 * `legacyFields` is used.
 */
export const updateSubmissionAsHead = async (
  submissionId,
  baseFields,
  headFields,
  legacyFields = {},
  questionFields = null,
  legacyQuestionHeadFields = null,
) => {
  const attempts = [
    ...(questionFields ? [{ ...baseFields, ...headFields, ...questionFields }] : []),
    { ...baseFields, ...headFields, ...(legacyQuestionHeadFields || {}) },
    { ...baseFields, ...legacyFields },
  ];

  let error = null;
  for (let i = 0; i < attempts.length; i++) {
    ({ error } = await supabase
      .from("quiz_analysis_submissions")
      .update(attempts[i])
      .eq("id", submissionId));
    if (!isMissingColumnError(error)) {
      return { error, usedLegacy: i === attempts.length - 1 && i > 0 };
    }
    console.warn(
      "Department Head feedback columns missing — apply migrations 20261020_add_faculty_head_feedback.sql and 20261025_add_faculty_head_question_feedback.sql",
    );
  }
  return { error, usedLegacy: true };
};

/**
 * Fold per-question comments into one text block, for storage where the
 * per-question column isn't available. `analysis` gives the question order.
 */
export const formatQuestionComments = (overall, questionComments, analysis = []) => {
  const lines = (analysis || [])
    .map((item, idx) => {
      const c = questionComments?.[item.questionId];
      return c && c.trim() ? `Q${idx + 1}: ${c.trim()}` : null;
    })
    .filter(Boolean);
  return [overall?.trim(), lines.join("\n")].filter(Boolean).join("\n\n");
};

export const countHeadSubmissions = (list) => {
  const c = { faculty_head_review: 0, faculty_head_approved: 0, revision_requested: 0, all: 0 };
  list.forEach((s) => {
    c.all++;
    if (c[s.status] !== undefined) c[s.status]++;
  });
  return c;
};

export const getSignatories = async (facultyHeadId) => {
  if (!facultyHeadId) return {};
  const { data } = await supabase
    .from("tos_signatories")
    .select("reviewer_name, approver_name, semester_override, school_year_override")
    .eq("faculty_head_id", facultyHeadId)
    .maybeSingle();
  return data || {};
};

export const exportSubmissionTosPdf = async (submission, facultyHeadId) => {
  const signatories = await getSignatories(facultyHeadId);
  await exportBloomsPdf({
    quizTitle: submission.quizzes?.title,
    results: submission.analysis_results,
    instructorName: submission.profiles ? getProfileName(submission.profiles) : undefined,
    reviewerName: signatories.reviewer_name,
    approverName: signatories.approver_name,
    submittedAt: submission.created_at,
    adminFeedback: submission.admin_feedback,
    status: submission.status,
    subjectCode: submission.section?.subjects?.code || submission.section?.subject_code,
    courseName: submission.section?.name,
    semesterOverride: signatories.semester_override,
    schoolYearOverride: signatories.school_year_override,
    reviewedAt: submission.reviewed_at,
    facultyHeadApprovedAt: submission.faculty_head_approved_at,
  });
};

export const exportSubmissionQuizPaper = async (submission, facultyHeadId) => {
  const signatories = await getSignatories(facultyHeadId);

  let questions = submission.analysis_results?.questionSnapshots || [];
  if (questions.length === 0 && submission.quiz_id) {
    const { data: qRows } = await supabase
      .from("questions")
      .select("id, text, type, options")
      .eq("quiz_id", submission.quiz_id)
      .order("created_at", { ascending: true });
    questions = (qRows || []).map((q) => ({
      questionId: q.id,
      questionText: q.text,
      type: q.type,
      options: q.options || [],
    }));
  }

  const questionFeedback = submission.question_feedback || {};
  const questionFeedbackByNumber = {};
  (submission.analysis_results?.analysis || []).forEach((item, idx) => {
    const fb = questionFeedback[item.questionId];
    if (fb) questionFeedbackByNumber[idx + 1] = fb;
  });

  await exportQuizPaperPdf({
    quizTitle: submission.quizzes?.title,
    quizDescription: submission.quizzes?.description,
    instructorName: submission.profiles ? getProfileName(submission.profiles) : undefined,
    courseName: submission.section?.name,
    subjectName: submission.section?.subjects?.name,
    semesterOverride: signatories.semester_override,
    schoolYearOverride: signatories.school_year_override,
    submittedAt: submission.created_at,
    questions,
    questionFeedback,
    questionFeedbackByNumber,
  });
};
