import { supabase } from "../supabaseClient";
import { AuthCallBack } from "../components/auth/AuthCallBack";

export const useGoogleLogin = () => {
  const handleGoogleLogin = async (e) => {
    const SITE_URL = import.meta.env.VITE_SITE_URL;
    e.preventDefault();
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: AuthCallBack,
        },
      });
      if (error) throw new Error(error.message);
    } catch (error) {
      console.error(error.message);
    }
  };
  return { handleGoogleLogin };
};
