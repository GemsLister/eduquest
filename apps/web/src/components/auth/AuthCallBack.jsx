import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";

export const AuthCallBack = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleRedirect = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.role === "teacher") navigate("/instructor-dashboard");
        else if (profile?.role === "student") navigate("/student-dashboard");
      }
    };
    handleRedirect();
  }, [navigate]);

  return (
    <div className="flex items-center justify-center h-screen bg-brand-navy">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand-gold"></div>
        <p className="mt-4 text-white font-semibold">Signing you in...</p>
      </div>
    </div>
  );
};
