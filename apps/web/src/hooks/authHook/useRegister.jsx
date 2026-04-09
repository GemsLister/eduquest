import { supabase } from "../../supabaseClient.js";
import { notify } from "../../utils/notify.jsx";

const validatePassword = (password) => {
  if (!password || password.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(password)) return "Password must contain an uppercase letter";
  if (!/[a-z]/.test(password)) return "Password must contain a lowercase letter";
  if (!/[0-9]/.test(password)) return "Password must contain a number";
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) return "Password must contain a special character";
  return null;
};

export const useRegister = () => {
  const handleRegister = async (userData) => {
    try {
      const passwordError = validatePassword(userData.password);
      if (passwordError) {
        notify.error(passwordError);
        return { success: false, message: passwordError };
      }

      if (!userData.captchaToken) {
        notify.error("Please complete the captcha verification");
        return { success: false, message: "Captcha required" };
      }

      const { data, error } = await supabase.auth.signUp({
        email: userData.email.trim(),
        password: userData.password,
        options: {
          captchaToken: userData.captchaToken,
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

      notify.success("Registration submitted! Awaiting Senior Faculty approval.");
      return { success: true, data };
    } catch (error) {
      notify.error(error.message || "Registration failed");
      return { success: false, message: error.message };
    }
  };
  return { handleRegister };
};
