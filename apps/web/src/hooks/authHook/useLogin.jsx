import { supabase } from "../../supabaseClient.js";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

const LOCKOUT_KEY = "login_lockout";
const ATTEMPTS_KEY = "login_attempts";
const MAX_ATTEMPTS = 10;
const LOCKOUT_DURATION = 60 * 60 * 1000; // 1 hour in ms

const getLoginState = () => {
  const lockoutUntil = parseInt(localStorage.getItem(LOCKOUT_KEY) || "0", 10);
  const attempts = parseInt(localStorage.getItem(ATTEMPTS_KEY) || "0", 10);
  return { lockoutUntil, attempts };
};

const recordFailedAttempt = () => {
  const attempts = parseInt(localStorage.getItem(ATTEMPTS_KEY) || "0", 10) + 1;
  localStorage.setItem(ATTEMPTS_KEY, String(attempts));
  if (attempts >= MAX_ATTEMPTS) {
    localStorage.setItem(LOCKOUT_KEY, String(Date.now() + LOCKOUT_DURATION));
  }
  return attempts;
};

const resetAttempts = () => {
  localStorage.removeItem(ATTEMPTS_KEY);
  localStorage.removeItem(LOCKOUT_KEY);
};

export const useLogin = () => {
  const navigate = useNavigate();
  const handleLogin = async (userData) => {
    try {
      // Check lockout
      const { lockoutUntil, attempts } = getLoginState();
      if (lockoutUntil && Date.now() < lockoutUntil) {
        const minutesLeft = Math.ceil((lockoutUntil - Date.now()) / 60000);
        toast.error(`Too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? "s" : ""}.`);
        return;
      }
      // Clear expired lockout
      if (lockoutUntil && Date.now() >= lockoutUntil) {
        resetAttempts();
      }

      if (!userData.captchaToken) {
        toast.error("Please complete the captcha verification");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: userData.email.trim(),
        password: userData.password,
        options: { captchaToken: userData.captchaToken },
      });

      // To notify users that their email is invalid
      if (error) {
        const newAttempts = recordFailedAttempt();
        const remaining = MAX_ATTEMPTS - newAttempts;
        if (remaining <= 0) {
          toast.error("Too many failed attempts. Your account is locked for 1 hour.");
        } else if (remaining <= 3) {
          toast.error(`Invalid email or password. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining before lockout.`);
        } else {
          toast.error("Invalid email or password");
        }
        return;
      }

      // Successful login — reset attempts
      resetAttempts();

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
      // TEST MODE: Auto-approve @student.buksu.edu.ph as instructors
      if (profile?.is_approved === false && !data.user.email.endsWith("@student.buksu.edu.ph")) {
        await supabase.auth.signOut();
        toast.info("Your account is pending admin approval.");
        return;
      }

      if (profile?.is_admin) {
        navigate("/admin-dashboard");
        return;
      }

      // TEST MODE: @student.buksu.edu.ph as instructors, @gmail.com as students
      const isInstructor = data.user.email.endsWith("@student.buksu.edu.ph");
      const isStudent = data.user.email.endsWith("@gmail.com");

      if (isInstructor) {
        navigate("/instructor-dashboard");
      } else if (isStudent) {
        await supabase.auth.signOut();
        toast.error("Access Denied: Students should take quizzes via shared links.");
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
