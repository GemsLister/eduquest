import { supabase } from "../../supabaseClient.js";
import { notify } from "../../utils/notify.jsx";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

// Set password via edge function so an email identity is created on OAuth-only users
const setOwnPassword = async (userId, password) => {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) return;
  await fetch(`${SUPABASE_URL}/functions/v1/change-instructor-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ userId, newPassword: password }),
  });
};

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

      // Handle "user already exists" — this happens when someone previously
      // tried Google Sign-In (which creates an auth.users row) and then
      // attempts to register with the same email. If they have no profile
      // yet, create one so they enter the pending-approval flow.
      const isExistingUser =
        error?.message?.toLowerCase().includes("already") ||
        data?.user?.identities?.length === 0;

      if (isExistingUser) {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();

        if (currentUser) {
          const { data: existingProfile } = await supabase
            .from("profiles")
            .select("id")
            .eq("id", currentUser.id)
            .maybeSingle();

          if (!existingProfile) {
            // Set password via edge function to create an email identity on OAuth users
            await setOwnPassword(currentUser.id, userData.password);
            await supabase.from("profiles").upsert({
              id: currentUser.id,
              username: userData.username.trim(),
              email: userData.email.trim(),
              is_approved: false,
              is_admin: false,
            });
            notify.success(
              "Registration submitted! Awaiting Senior Faculty approval.",
            );
            setTimeout(() => (window.location.href = "/"), 2000);
            return { success: true };
          }
        }

        // Profile already exists — they're already registered
        notify.error(
          "An account with this email already exists. Try logging in instead.",
        );
        return { success: false, message: "Account already exists" };
      }

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
      setTimeout(() => (window.location.href = "/"), 2000);
      return { success: true, data };
    } catch (error) {
      // Handle orphan auth user from a previous Google Sign-In attempt.
      // signUp throws "User already registered" when the email exists in
      // auth.users but the person may have no profile row yet.
      if (error.message?.toLowerCase().includes("already")) {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();

        if (currentUser) {
          const { data: existingProfile } = await supabase
            .from("profiles")
            .select("id")
            .eq("id", currentUser.id)
            .maybeSingle();

          if (!existingProfile) {
            // Set password via edge function to create an email identity on OAuth users
            await setOwnPassword(currentUser.id, userData.password);
            await supabase.from("profiles").upsert({
              id: currentUser.id,
              username: userData.username.trim(),
              email: userData.email.trim(),
              is_approved: false,
              is_admin: false,
            });
            notify.success(
              "Registration submitted! Awaiting Senior Faculty approval.",
            );
            setTimeout(() => (window.location.href = "/"), 2000);
            return { success: true };
          }
        }
      }

      notify.error(error.message || "Registration failed");
      return { success: false, message: error.message };
    }
  };
  return { handleRegister };
};
