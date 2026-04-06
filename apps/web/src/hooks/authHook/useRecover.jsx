import { supabase } from "../../supabaseClient.js";
import { notify } from "../../utils/notify.jsx";

export const useRecover = () => {
  const handleRecover = async (userData) => {
    try {
      if (
        userData.email.endsWith(
          import.meta.env.VITE_INSTRUCTOR_ACCOUNT_EXTENSION,
        )
      ) {
        const { data, error } = await supabase.auth.resetPasswordForEmail(
          userData.email,
          {
            redirectTo: import.meta.env.VITE_CHANGE_PASSWORD_URL,
          },
        );
        notify.success("Reset password link sent to your account");
        console.log(data.message);
      } else notify.error("Invalid Email");
    } catch (error) {
      notify.error("Email not found");
    }
  };
  return { handleRecover };
};
