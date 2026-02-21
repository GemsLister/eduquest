import { supabase } from "../../supabaseClient";
import { AuthCallBack } from "../../components/auth/AuthCallBack";

export const useGoogleLogin = () => {
  const handleGoogleLogin = async (e) => {
    e.preventDefault();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: import.meta.env.VITE_INSTRUCTOR_DASHBOARD_URL,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
  };
  return { handleGoogleLogin };
};
