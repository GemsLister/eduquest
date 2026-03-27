import { supabase } from "../../supabaseClient";
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
          hd: "student.buksu.edu.ph"
        },
      },
    });
  };
  const handleGoogleQuizLogin = async (quizToken, sectionId = null) => {
    let redirectUrl = `${window.location.origin}/quiz/${quizToken}?auth=success`;
    if (sectionId) {
      redirectUrl += `&section=${sectionId}`;
    }
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
          hd: "gmail.com"
        },
      },
    });
    if (error) console.error('Google login error:', error);
  };

  return { handleGoogleLogin, handleGoogleQuizLogin };
};
