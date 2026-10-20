import { supabase } from "../supabaseClient";

const normalizeDepartment = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

/**
 * Department Heads who should hear about a submission from `instructorId`.
 * Only the heads of the instructor's department when both sides have a
 * department set; otherwise every Department Head, so nothing goes unrouted.
 */
export const getDepartmentHeadIdsFor = async (instructorId) => {
  const { data: heads, error } = await supabase
    .from("profiles")
    .select("id, department")
    .eq("is_faculty_head", true);

  // profiles.department isn't there until the 20261022 migration runs
  if (error) {
    const { data: fallback } = await supabase
      .from("profiles")
      .select("id")
      .eq("is_faculty_head", true);
    return (fallback || []).map((h) => h.id);
  }

  const allHeads = heads || [];
  if (!instructorId) return allHeads.map((h) => h.id);

  const { data: instructor } = await supabase
    .from("profiles")
    .select("department")
    .eq("id", instructorId)
    .maybeSingle();

  const department = normalizeDepartment(instructor?.department);
  if (!department) return allHeads.map((h) => h.id);

  const sameDepartment = allHeads.filter(
    (h) => normalizeDepartment(h.department) === department,
  );
  return (sameDepartment.length > 0 ? sameDepartment : allHeads).map((h) => h.id);
};

/** Send one notification to each Department Head responsible for `instructorId`. */
export const notifyDepartmentHeads = async (instructorId, notification) => {
  const headIds = await getDepartmentHeadIdsFor(instructorId);
  if (headIds.length === 0) return;
  const { error } = await supabase
    .from("notifications")
    .insert(headIds.map((id) => ({ user_id: id, ...notification })));
  if (error) throw error;
};
