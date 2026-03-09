import { supabase } from "../../supabaseClient.js";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

export const useLogin = () => {
  const navigate = useNavigate();
  const handleLogin = async (userData) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: userData.email,
        password: userData.password,
      });

      // To notify users that their email is invalid
      if (error) {
        toast.error("Invalid email or password");
        return;
      }

      // Check profile for role
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin, is_instructor")
        .eq("id", data.user.id)
        .single();

      if (profile?.is_admin) {
        navigate("/admin-dashboard");
        return;
      }

      // Allow if is_instructor flag is set OR email matches the allowed domain
      if (
        profile?.is_instructor ||
        data.user.email.endsWith(
          import.meta.env.VITE_INSTRUCTOR_ACCOUNT_EXTENSION,
        )
      ) {
        navigate("/instructor-dashboard");
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
