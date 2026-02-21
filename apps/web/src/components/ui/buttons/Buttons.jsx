import { useState } from "react";
import googleIcon from "../../../assets/google-icon.png";
// import { useRegister } from "../../../hooks/useRegister.jsx";
// import { useRecover } from "../../../hooks/useRecover.jsx";
// import { useChangePassword } from "../../../hooks/useChangePassword.jsx";
// import { useLogin } from "../../../hooks/useLogin.jsx";
import * as AuthHooks from "../../../hooks/authHook/authHooks.js";
import {
  VisibilityOffIcon,
  VisibilityOnIcon,
} from "../../../assets/svg/ShowPasswordIcons.jsx";
import { toast } from "react-toastify";

export const GoogleButton = () => {
  const { handleGoogleLogin } = AuthHooks.useGoogleLogin();

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
  const { handleRegister } = AuthHooks.useRegister();
  const { handleRecover } = AuthHooks.useRecover();
  const { handleChangePassword } = AuthHooks.useChangePassword();
  const { handleLogin } = AuthHooks.useLogin();

  const handleClick = (e) => {
    e.preventDefault();
    switch (name) {
      case "Login":
        try {
          if (!user.email || !user.password) toast.error("Fill out the form");

          if (!user.email || !user.password) alert("Needed");
          else if (!user.captchaToken)
            toast.error("Please complete the reCAPTCHA");
          else {
            const result = handleLogin(user);
            if (!result && result.success) console.error(error);
          }
        } catch (error) {
          // notify();
          console.error(error);
        }
        break;

      case "Register":
        try {
          if (!user.username || !user.password || !user.email)
            toast.error("Fill out the form");
          else {
            const result = handleRegister(user);
            if (!result && result.success) console.error(error);
          }
        } catch (error) {
          console.error(error);
        }
        break;

      case "Continue":
        try {
          if (!user.email) toast.error(error.message || "Fill out the form");
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
          if (!user.password) toast.error(error.message || "Fill out the form");
          handleChangePassword(user);
          console.log(`change password ${user.password}`);
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
