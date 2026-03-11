import { supabase } from "../../supabaseClient";

/**
 * Fetch all sections belonging to a specific instructor
 * @param {string} instructorId - The UUID of the instructor
 */
export const getInstructorsSection = async (instructorId) => {
  try {
    const { data, error } = await supabase
      .from("sections")
      .select("id, name, description")
      .eq("instructor_id", instructorId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase error:", error.message);
      return { data: null, error };
    }

    return { data, error: null }; // Success return
  } catch (error) {
    console.error("System error fetching sections:", error);
    return { data: null, error }; // Catch-all return
  }
};