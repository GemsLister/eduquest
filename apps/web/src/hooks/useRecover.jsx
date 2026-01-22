import { supabase } from "../supabaseClient.js";

export const useRecover = () => {
  const handleRecover = async (userData) => {
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(
        userData.email,
        {
          redirectTo: import.meta.env.VITE_CHANGE_PASSWORD_URL,
        },
      );
      if (error) alert("Email not found");
      else alert("Open gmail");
      console.log(data.message);
    } catch (error) {
      console.error(error);
    }
  };
  return { handleRecover };
};
