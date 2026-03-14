import { supabase } from "../../supabaseClient.js";
import { toast } from "react-toastify";
export const useRegister = () => {
  const handleRegister = async (userData) => {
    try {
      {
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
        if (error) throw error;

        // Create a profile row with is_approved = false so admin can review
        if (data?.user) {
          await supabase.from("profiles").upsert({
            id: data.user.id,
            username: userData.username.trim(),
            email: userData.email.trim(),
            is_approved: false,
            is_admin: false,
          });
        }

        toast.success("Registration submitted! Awaiting admin approval.");
        return { success: true, data };
      }
    } catch (error) {
      console.log(error.message);
      toast.error(error.message || "Registration failed");
      return { success: false, message: error.message };
    }
  };
  return { handleRegister };
};
