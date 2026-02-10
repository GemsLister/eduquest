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
          .single();

        if (profile?.role === "teacher") navigate("/instructor-dashboard");
        else if (profile?.role === "student") navigate("/student-dashboard");
      }
    };
    handleRedirect();
  }, [navigate]);

  return <div>Loading...</div>;
};
