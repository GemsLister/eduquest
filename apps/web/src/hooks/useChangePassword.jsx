import { supabase } from "../supabaseClient.js";

export const useChangePassword = () => {
  const handleChangePassword = async (userData) => {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: userData.password,
      });
      if (error) throw new Error(error.message);
      else console.log(data.message);
    } catch (error) {
      console.error(error);
    }
  };
  return { handleChangePassword };
};
