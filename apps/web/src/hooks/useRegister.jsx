import { supabase } from "../supabaseClient.js";
export const useRegister = () => {
  const handleRegister = async (userData) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: userData.email.trim(),
        password: userData.password,
        options: {
          data: {
            username: userData.username.trim(),
          },
          emailRedirectTo: import.meta.env.VITE_LOGIN_URL,
        },
      });
      if (error) throw error;
      console.log(data.user);
    } catch (error) {
      console.log(error.message);
    }
  };
  return { handleRegister };
};
