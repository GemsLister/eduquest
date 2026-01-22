import { supabase } from "../supabaseClient.js";

export const useLogout = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error) {
    console.log(error);
  }
};
