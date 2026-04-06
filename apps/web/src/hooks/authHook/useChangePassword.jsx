import { supabase } from "../../supabaseClient.js";
import { useNavigate } from "react-router-dom";
import { notify } from "../../utils/notify.jsx";

export const useChangePassword = () => {
  const navigate = useNavigate();
  const handleChangePassword = async (userData) => {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: userData.password,
      });
      if (error) throw new Error(error.message);
      console.log(data.message);
      notify.success("Password Changed!")
      navigate("/");
    } catch (error) {
      console.error(error);
    }
  };
  return { handleChangePassword };
};
