import { supabase } from "../supabaseClient.js";

export const logAudit = async ({
  action,
  tableName = null,
  recordId = null,
  oldValues = null,
  newValues = null,
  userRole = null,
}) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const { error } = await supabase.from("audit_trail").insert({
      action,
      table_name: tableName,
      record_id: recordId,
      old_values: oldValues,
      new_values: newValues,
      user_id: user.id,
      user_role: userRole,
    });

    if (error) {
      console.error("Error inserting audit log:", error);
    }
  } catch (error) {
    console.error("Error logging audit:", error);
  }
};
