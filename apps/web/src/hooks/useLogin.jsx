import { supabase } from "../supabaseClient.js";
import { useNavigate } from "react-router";

export const useLogin = () => {
  const navigate = useNavigate();
  const handleLogin = async (userData) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: userData.email,
        password: userData.password,
      });
      if (error) alert(`Invalid account: ${error}`);
      else navigate("/instructor-dashboard");
      console.log(data.message);
    } catch (error) {
      console.error(error);
    }
  };
  return { handleLogin };
};
