import { supabase } from "../supabaseClient.js";
import eduquestLogo from "../assets/eduquest-logo.png";

export const GoogleButton = () => {
  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: import.meta.env.VITE_REDIRECT_URI,
        },
      });
      if (error) throw new Error(error.message);
    } catch (error) {
      console.error(error.message);
    }
  };
  return (
    <button onClick={handleGoogleLogin}>
      <img src={eduquestLogo} alt="eduquest-logo" />
      Login with Google
    </button>
  );
};
