import { supabase } from "../supabaseClient.js";
import { useNavigate } from "react-router-dom";

export const useLogin = () => {
  const navigate = useNavigate();
  const handleLogin = async (userData) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: userData.email,
        password: userData.password,
      });

      if (error) throw error;
      if (
        data.user.email.endsWith(
          import.meta.env.VITE_INSTRUCTOR_ACCOUNT_EXTENSION,
        )
      ) {
        navigate("/instructor-dashboard");
      } else if (
        data.user.email.endsWith(import.meta.env.VITE_STUDENT_ACCOUNT_EXTENSION)
      ) {
        navigate("/student-dashboard");
      }

      console.log(data.message);
    } catch (error) {
      console.error(error);
    }
  };
  return { handleLogin };
};
