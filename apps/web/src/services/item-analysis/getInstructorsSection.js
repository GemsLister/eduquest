import { supabase } from "../../supabaseClient";
export const getInstructorsSection = async (authUser) => {
  try {
    const { data, error } = await supabase
      .from("sections")
      .select("id, name, description")
      .eq("instructor_id", authUser)
      .order("created_at", { ascending: false });
    if (error) console.error("Error");
  } catch (error) {
    console.error("Error");
  }
};
