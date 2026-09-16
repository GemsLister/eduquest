import { supabase } from "../../supabaseClient.js";
import { useNavigate } from "react-router-dom";
import { notify } from "../../utils/notify.jsx";

const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]).{8,}$/;

export const useChangePassword = () => {
  const navigate = useNavigate();
  const handleChangePassword = async (userData) => {
    try {
      if (!userData.password) {
        notify.error("Password is required.");
        return;
      }
      if (!STRONG_PASSWORD.test(userData.password)) {
        notify.error("Password must be at least 8 characters with uppercase, lowercase, number, and special character.");
        return;
      }
      if (userData.confirmPassword !== undefined && userData.password !== userData.confirmPassword) {
        notify.error("Passwords do not match.");
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: userData.password,
      });
      if (error) throw new Error(error.message);
      notify.success("Password Changed!");
      navigate("/");
    } catch (error) {
      console.error("Change password error:", error);
      notify.error(error.message || "Failed to change password. Please try again.");
    }
  };
  return { handleChangePassword };
};
