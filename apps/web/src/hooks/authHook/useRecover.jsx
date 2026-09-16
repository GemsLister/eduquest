import { supabase } from "../../supabaseClient.js";
import { notify } from "../../utils/notify.jsx";

export const useRecover = () => {
  const handleRecover = async (userData) => {
    try {
      const email = String(userData?.email || "").trim();
      if (!email) {
        notify.error("Please enter your email");
        return;
      }

      if (
        email.endsWith(
          import.meta.env.VITE_INSTRUCTOR_ACCOUNT_EXTENSION || "@student.buksu.edu.ph",
        )
      ) {
        const resetOptions = {
          redirectTo: import.meta.env.VITE_CHANGE_PASSWORD_URL,
        };

        if (userData.captchaToken && userData.captchaToken !== "dummy-token-for-dev") {
          resetOptions.captchaToken = userData.captchaToken;
        }

        const { data, error } = await supabase.auth.resetPasswordForEmail(
          email,
          resetOptions,
        );

        if (error) {
          const errorMessage = String(error.message || "").toLowerCase();
          const isCaptchaError =
            errorMessage.includes("captcha") ||
            errorMessage.includes("challenge") ||
            errorMessage.includes("turnstile") ||
            errorMessage.includes("token");

          if (isCaptchaError) {
            notify.error(
              "Captcha verification failed or expired. Please complete captcha again.",
            );
            userData.onCaptchaReset?.();
            return;
          }
          throw error;
        }

        notify.success("Reset password link sent to your account");
      } else {
        notify.error("Invalid Email format for instructor account");
      }
    } catch (error) {
      userData.onCaptchaReset?.();
      notify.error(error.message || "Email not found");
    }
  };
  return { handleRecover };
};
