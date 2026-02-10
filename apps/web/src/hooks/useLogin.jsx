import { supabase } from "../supabaseClient.js";
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
      if (error) toast.error("Invalid email or password");

      if (
        !data.user.email.endsWith(
          import.meta.env.VITE_INSTRUCTOR_ACCOUNT_EXTENSION,
        )
      ) {
        await supabase.auth.signOut();
        toast.error("Access Denied: Instructors Only!");
      } else navigate("/instructor-dashboard");

      console.log(data.message);
    } catch (error) {
      toast.error(error);
    }
  };
  return { handleLogin };
};
