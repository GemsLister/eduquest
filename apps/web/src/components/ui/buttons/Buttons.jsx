import { useState } from "react";
import googleIcon from "../../../assets/google-icon.png";
import * as AuthHooks from "../../../hooks/authHook/authHooks.js";
import {
  VisibilityOffIcon,
  VisibilityOnIcon,
} from "../../../assets/svg/ShowPasswordIcons.jsx";
import { notify } from "../../../utils/notify.jsx";

export const GoogleButton = () => {
  const { handleGoogleLogin } = AuthHooks.useGoogleLogin();

  return (
    <button
      type="button"
      onClick={handleGoogleLogin}
      className="flex items-center justify-center border-[2px] rounded-[8px] border-pale-silver hover:bg-brand-gold/5 hover:border-brand-gold/30 p-2.5 text-[clamp(10px,3dvw,14px)] gap-2.5 transition-colors"
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
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async (e) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    try {
      switch (name) {
        case "Login":
          if (!user.email || !user.password) {
            notify.error("Fill out the form");
          } else {
            await handleLogin(user);
          }
          break;

        case "Register":
          if (
            !user.username ||
            !user.password ||
            !user.email ||
            !user.confirmPassword
          ) {
            notify.error("Fill out the form");
          } else if (user.password !== user.confirmPassword) {
            notify.error("Passwords do not match");
          } else {
            await handleRegister(user);
          }
          break;

        case "Continue":
          if (!user.email) {
            notify.error("Fill out the form");
          } else {
            await handleRecover(user);
          }
          break;

        case "Change Password":
          if (!user.password) {
            notify.error("Fill out the form");
          } else {
            await handleChangePassword(user);
          }
          break;
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      type="submit"
      onClick={handleClick}
      disabled={isLoading}
      className="bg-brand-gold hover:bg-brand-gold-dark mt-7 text-brand-navy font-semibold p-2.5 rounded-[8px] text-[clamp(10px,3dvw,14px)] w-full transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {isLoading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          {name === "Login" ? "Signing in..." : name === "Register" ? "Registering..." : name === "Continue" ? "Sending..." : "Saving..."}
        </span>
      ) : (
        name
      )}
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
