import { supabase } from "../supabaseClient";

/**
 * Send one notification to every Department Head. The system serves a single
 * department (IT), so every head reviews every forwarded quiz.
 */
export const notifyDepartmentHeads = async (notification) => {
  const { data: heads, error: headsError } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_faculty_head", true);
  if (headsError) throw headsError;
  if (!heads?.length) return;

  const { error } = await supabase
    .from("notifications")
    .insert(heads.map((h) => ({ user_id: h.id, ...notification })));
  if (error) throw error;
};
