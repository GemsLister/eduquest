import { supabase } from "../supabaseClient.js";
import { toast } from "react-toastify";
export const useRegister = () => {
  const handleRegister = async (userData) => {
    try {
      if (
        !userData.email.endsWith(
          import.meta.env.VITE_INSTRUCTOR_ACCOUNT_EXTENSION,
        )
      )
        toast.error("Institutional Account of Instructors Only!");
      else {
        const { data, error } = await supabase.auth.signUp({
          email: userData.email.trim(),
          password: userData.password,
          options: {
            data: {
              username: userData.username.trim(),
            },
            emailRedirectTo: import.meta.env.VITE_LOGIN_URL,
          },
        });
        toast.success("Success, confirmation link sent in your account");
        return { success: true, data };
      }
    } catch (error) {
      console.log(error.message);
      return { success: false, message: error.message };
    }
  };
  return { handleRegister };
};
