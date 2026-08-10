import { supabase } from "../../supabaseClient";

export const useGoogleLogin = () => {
  const handleGoogleLogin = async (e) => {
    e.preventDefault();
    sessionStorage.setItem("skipGateLoaderOnce", "1");

    const redirectUrl =
      import.meta.env.VITE_INSTRUCTOR_DASHBOARD_URL ||
      `${window.location.origin}/instructor-dashboard`;

    const instructorDomain =
      import.meta.env.VITE_INSTRUCTOR_ACCOUNT_EXTENSION?.replace("@", "") ||
      null;

    const queryParams = {
      access_type: "offline",
      prompt: "consent",
    };

    if (instructorDomain) {
      queryParams.hd = instructorDomain;
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
        queryParams,
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
        },
      },
    });
    if (error) console.error("Google login error:", error);
  };

  return { handleGoogleLogin, handleGoogleQuizLogin };
};
