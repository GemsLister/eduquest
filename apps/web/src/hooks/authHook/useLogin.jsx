import { supabase } from "../../supabaseClient.js";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

export const useLogin = () => {
  const navigate = useNavigate();
  const handleLogin = async (userData) => {
    try {
      const email = userData.email.trim();

      if (!userData.captchaToken) {
        toast.error("Please complete the captcha verification");
        return;
      }

      // Check if account is locked (server-side)
      const { data: lockStatus } = await supabase.rpc("check_login_lockout", {
        p_email: email,
      });
      if (lockStatus?.is_locked) {
        toast.error(
          `Account is temporarily locked. Try again in ${lockStatus.minutes_left} minute${lockStatus.minutes_left !== 1 ? "s" : ""}.`,
        );
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: userData.password,
        options: { captchaToken: userData.captchaToken },
      });

      if (error) {
        // Record failed attempt server-side
        const { data: result } = await supabase.rpc("record_failed_login", {
          p_email: email,
        });

        if (result?.is_locked) {
          toast.error(
            `Too many failed attempts. Account locked for ${result.minutes_left} minutes.`,
          );
        } else if (result?.remaining_attempts <= 2) {
          toast.error(
            `Invalid email or password. ${result.remaining_attempts} attempt${result.remaining_attempts !== 1 ? "s" : ""} remaining before lockout.`,
          );
        } else {
          toast.error("Invalid email or password");
        }
        return;
      }

      // Successful login — clear attempts server-side
      await supabase.rpc("reset_login_attempts", { p_email: email });

      // Check profile for role
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profile?.is_disabled) {
        await supabase.auth.signOut();
        toast.error("This account has been disabled by the admin");
        return;
      }

      // Block if explicitly pending approval (is_approved === false)
      if (profile?.is_approved === false) {
        await supabase.auth.signOut();
        toast.info("Your account is pending admin approval.");
        return;
      }

      if (profile?.is_admin) {
        navigate("/admin-dashboard");
        return;
      }

      if (profile?.role === "teacher" || profile?.is_instructor) {
        navigate("/instructor-dashboard");
      } else if (profile?.role === "student") {
        await supabase.auth.signOut();
        toast.error(
          "Access Denied: Students should take quizzes via shared links.",
        );
      } else {
        await supabase.auth.signOut();
        toast.error("Access Denied: Instructors Only!");
      }
    } catch (error) {
      console.error(error);
      toast.error("An error occurred during login");
    }
  };
  return { handleLogin };
};
