import { supabase } from "../../supabaseClient";
export const fetchProfiles = async (userIds) => {
  try {
    if (!userIds || userIds.length === 0) {
      return { data: {}, error: null };
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, first_name, last_name, email")
      .in("id", [...new Set(userIds)]);

    if (error) throw error;

    // Convert array to map for easier lookup
    const profilesMap = {};
    if (data) {
      data.forEach((p) => {
        profilesMap[p.id] = p;
      });
    }

    return { data: profilesMap, error: null };
  } catch (error) {
    console.error("Error fetching profiles:", error);
    return { data: null, error };
  }
};
