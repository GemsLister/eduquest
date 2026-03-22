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
        .select("*")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profile?.is_disabled) {
        await supabase.auth.signOut();
        toast.error("This account has been disabled by the admin");
        return;
      }

      // Block if explicitly pending approval (is_approved === false)
      // TEST MODE: Auto-approve @student.buksu.edu.ph as instructors
      if (profile?.is_approved === false && !data.user.email.endsWith("@student.buksu.edu.ph")) {
        await supabase.auth.signOut();
        toast.info("Your account is pending admin approval.");
        return;
      }

      if (profile?.is_admin) {
        navigate("/admin-dashboard");
        return;
      }

      // TEST MODE: @student.buksu.edu.ph as instructors, @gmail.com as students
      const isInstructor = data.user.email.endsWith("@student.buksu.edu.ph");
      const isStudent = data.user.email.endsWith("@gmail.com");

      if (isInstructor) {
        navigate("/instructor-dashboard");
      } else if (isStudent) {
        await supabase.auth.signOut();
        toast.error("Access Denied: Students should take quizzes via shared links.");
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
