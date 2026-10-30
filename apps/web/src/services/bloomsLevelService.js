import { supabase } from "../supabaseClient";
import { logAudit } from "./auditService";
import { getProfileName } from "../utils/profileName";
import { changeQuestionLevel } from "../utils/bloomsLevels";

// Level editor roles mapped to the audit trail's role keys
const AUDIT_ROLES = {
  instructor: "instructor",
  peer_reviewer: "peer_reviewer",
  senior_faculty: "admin",
  department_head: "faculty_head",
};

/** { id, name, role } of the signed-in user, recorded with each level change. */
export const getLevelEditor = async (role) => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Please sign in again.");
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, username, email")
    .eq("id", user.id)
    .maybeSingle();
  return { id: user.id, name: getProfileName(profile, user.email || "Unknown"), role };
};

/**
 * Copies a submission's final Bloom's levels onto its questions
 * (questions.blooms_level / cognitive_level). Failures are logged, not
 * thrown: the submission itself is already saved.
 */
export const syncQuestionLevels = async (submissionId) => {
  const { error } = await supabase.rpc("sync_question_blooms_levels", {
    p_submission_id: submissionId,
  });
  if (error) console.warn("Could not copy Bloom's levels to questions:", error);
};

export const logLevelChange = ({ quizId, quizTitle, role, questionNumber, from, to, reason }) =>
  logAudit({
    action: "BLOOMS_LEVEL_CHANGED",
    tableName: "quizzes",
    recordId: quizId,
    itemName: quizTitle || "Exam",
    previousStatus: from,
    newStatus: to,
    reason,
    changeSummary: `Question ${questionNumber}: ${from} → ${to}`,
    userRole: AUDIT_ROLES[role] || null,
  });

/**
 * Saves a reviewer's level change on a submitted exam and returns the
 * updated analysis_results. The latest analysis is re-read first so two
 * reviewers' edits don't overwrite each other.
 */
export const saveSubmissionLevelChange = async ({
  submissionId,
  quizId,
  quizTitle,
  questionId,
  questionNumber,
  newLevel,
  reason,
  role,
}) => {
  const editor = await getLevelEditor(role);

  const { data: current, error: readError } = await supabase
    .from("quiz_analysis_submissions")
    .select("analysis_results")
    .eq("id", submissionId)
    .single();
  if (readError) throw readError;

  const item = (current.analysis_results?.analysis || []).find(
    (a) => String(a.questionId) === String(questionId),
  );
  if (!item) throw new Error("This question is no longer in the analysis.");
  const previousLevel = item.bloomsLevel;

  const updated = changeQuestionLevel(current.analysis_results, questionId, newLevel, {
    editor,
    reason,
  });

  const { data: saved, error: saveError } = await supabase
    .from("quiz_analysis_submissions")
    .update({ analysis_results: updated })
    .eq("id", submissionId)
    .select("id");
  if (saveError) throw saveError;
  if (!saved?.length) throw new Error("You can't change Bloom's levels on this exam.");

  await syncQuestionLevels(submissionId);
  await logLevelChange({
    quizId,
    quizTitle,
    role,
    questionNumber,
    from: previousLevel,
    to: newLevel,
    reason,
  });

  return updated;
};
