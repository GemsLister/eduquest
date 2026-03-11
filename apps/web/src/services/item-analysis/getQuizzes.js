import { supabase } from "../../supabaseClient";

/**
 * Fetch all quizzes for a specific section
 * @param {string} sectionId - The ID of the section to filter by
 */
export const getQuizzes = async (sectionId) => {
  try {
    // Return early if no sectionId is provided to avoid unnecessary DB calls
    if (!sectionId) return { data: [], error: null };

    const { data, error } = await supabase
      .from("quizzes")
      .select("id, title, is_published")
      .eq("section_id", sectionId) // Corrected parameter usage
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase error fetching quizzes:", error.message);
      return { data: null, error };
    }

    return { data: data || [], error: null };
  } catch (error) {
    console.error("System error fetching quizzes:", error);
    return { data: null, error };
  }
};