import { useState } from "react";
import { supabase } from "../supabaseClient.js";
import googleIcon from "../assets/google-icon.png";
import { useRegister } from "../hooks/useRegister.jsx";
import { useRecover } from "../hooks/useRecover.jsx";
import { useChangePassword } from "../hooks/useChangePassword.jsx";
import { useLogin } from "../hooks/useLogin.jsx";
import {
  VisibilityOffIcon,
  VisibilityOnIcon,
} from "../assets/svg/ShowPasswordIcons.jsx";

export const GoogleButton = () => {
  const handleGoogleLogin = async (e) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: import.meta.env.VITE_INSTRUCTOR_DASHBOARD_URL,
        },
      });
      if (error) throw new Error(error.message);
      if (data.url) redirect(data.url);
    } catch (error) {
      console.error(error.message);
    }
  };
  return (
    <button
      type="button"
      onClick={handleGoogleLogin}
      className="flex items-center justify-center border-[2px] rounded-[8px] border-pale-silver hover:bg-fur-white p-2.5 text-[clamp(10px,3dvw,14px)] gap-2.5"
    >
      <img
        src={googleIcon}
        alt="eduquest-logo"
        className="h-[clamp(16px,2dvw,18px)]"
      />
      Continue with Google
    </button>
  );
};

export const AuthButton = ({ name, user }) => {
  const { handleRegister } = useRegister();
  const { handleRecover } = useRecover();
  const { handleChangePassword } = useChangePassword();
  const { handleLogin } = useLogin();

  const handleClick = (e) => {
    e.preventDefault();
    switch (name) {
      case "Login":
        try {
          if (!user.email || !user.password) alert("Needed");
          else {
            handleLogin(user);
            console.log(`Success ${user.email}`);
          }
        } catch (error) {
          console.error(error);
        }
        break;

      case "Register":
        try {
          if (!user.username || !user.password || !user.email) alert("Needed!");
          else {
            handleRegister(user);
            console.log("success");
          }
        } catch (error) {
          console.error(error);
        }
        break;

      case "Continue":
        try {
          if (!user.email) alert("Needed!");
          else {
            handleRecover(user);
            console.log(`continue ${user.email}`);
          }
        } catch (error) {
          console.error(error);
        }
        break;

      case "Change Password":
        try {
          if (!user.password) alert("Needed!");
          else {
            handleChangePassword(user);
            console.log(`change password ${user.email}`);
          }
        } catch (error) {
          console.error(error);
        }
        break;
    }
  };

  return (
    <button
      type="submit"
      onClick={handleClick}
      className="bg-sea-green hover:bg-hornblende-green mt-7 text-white p-2.5 rounded-[8px] text-[clamp(10px,3dvw,14px)] w-full"
    >
      {name}
    </button>
  );
};

export const ShowPassword = ({ buttonType }) => {
  const [showPassword, setShowPassword] = useState(false);
  const handleShowPassword = () => {
    const inputId = document.getElementById(buttonType.id);
    console.log(inputId.type);
    if (inputId.type === "password") {
      inputId.type = "text";
      setShowPassword(true);
    } else {
      inputId.type = "password";
      setShowPassword(false);
    }
  };

  return (
    <button
      type="button"
      className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center"
      onClick={handleShowPassword}
    >
      {showPassword ? <VisibilityOnIcon /> : <VisibilityOffIcon />}
    </button>
  );
};
