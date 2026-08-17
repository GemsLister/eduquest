import { supabase } from "../supabaseClient.js";

/**
 * Universal Audit & System Activity Logger Service
 * Logs structured, human-readable user activity events across the application.
 */

export const logAudit = async ({
  action,
  tableName = null,
  recordId = null,
  itemName = null,
  subjectName = null,
  sectionName = null,
  previousStatus = null,
  newStatus = null,
  reason = null,
  changeSummary = null,
  oldValues = null,
  newValues = null,
  userRole = null,
}) => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    let role = userRole;
    if (!role) {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_faculty_head, is_admin")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.is_admin) {
          role = "admin";
        } else if (profile?.is_faculty_head) {
          role = "faculty_head";
        } else {
          role = "instructor";
        }
      } catch (err) {
        role = "user";
      }
    }

    const payload = {
      action,
      table_name: tableName,
      record_id: recordId,
      item_name: itemName,
      subject_name: subjectName,
      section_name: sectionName,
      previous_status: previousStatus,
      new_status: newStatus,
      reason,
      change_summary: changeSummary,
      old_values: oldValues,
      new_values: newValues,
      user_id: user.id,
      user_role: role,
    };

    const { error } = await supabase.from("audit_trail").insert(payload);

    if (error) {
      console.error("Error inserting audit log:", error);
    }
  } catch (error) {
    console.error("Error logging audit:", error);
  }
};

/**
 * Helper to log quiz lifecycle events
 */
export const logQuizActivity = async ({
  quizId,
  quizTitle,
  action,
  subjectName = null,
  sectionName = null,
  previousStatus = null,
  newStatus = null,
  reason = null,
  changeSummary = null,
}) => {
  return logAudit({
    action,
    tableName: "quizzes",
    recordId: quizId,
    itemName: quizTitle,
    subjectName,
    sectionName,
    previousStatus,
    newStatus,
    reason,
    changeSummary,
  });
};

/**
 * Helper to log question / question bank events
 */
export const logQuestionActivity = async ({
  questionId,
  questionText,
  action,
  quizTitle = null,
  subjectName = null,
  reason = null,
  changeSummary = null,
}) => {
  return logAudit({
    action,
    tableName: "questions",
    recordId: questionId,
    itemName: questionText ? questionText.slice(0, 80) : "Question",
    subjectName,
    sectionName: quizTitle,
    reason,
    changeSummary,
  });
};
