import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  GoogleButton,
  AuthButton,
} from "../../components/ui/buttons/Buttons.jsx";
import { Turnstile } from "../../components/Turnstile.jsx";
import citlLogo from "../../assets/BUKSU_CITL.jpg";

export const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const handleCaptcha = useCallback((token) => setCaptchaToken(token), []);
  const resetCaptcha = useCallback(() => {
    setCaptchaToken(null);
    setCaptchaResetKey((prev) => prev + 1);
  }, []);
  const userData = {
    email,
    password,
    captchaToken,
    onCaptchaReset: resetCaptcha,
  };

  const inputs = [
    {
      type: "email",
      name: "email",
      id: "email",
      placeholder: "name@buksu.edu.ph",
      onChange: (e) => setEmail(e.target.value),
      value: email,
    },
    {
      type: showPassword ? "text" : "password",
      name: "password",
      id: "password",
      placeholder: `Password`,
      onChange: (e) => setPassword(e.target.value),
      value: password,
    },
  ];

  return (
    <div className="flex items-center justify-center h-screen flex-1 bg-brand-navy">
      <form className="p-[clamp(30px,2dvw,80px)] bg-full-white rounded-[15px] shadow-2xl border-t-4 border-brand-gold">
        <fieldset className="flex flex-col w-[clamp(330px,30dvw,400px)]">
          {/* Logo */}
          <div className="flex flex-col mb-5 gap-15">
            <div className="flex items-center gap-3">
              <img
                src={citlLogo}
                alt="BUKSU CITL logo"
                className="w-[clamp(40px,5dvw,55px)] h-[clamp(40px,5dvw,55px)] rounded-full object-cover"
              />
              <span className="text-[clamp(1.2rem,2.5dvw,1.6rem)] font-bold text-brand-navy tracking-tight">
                BUKSU CITL
              </span>
            </div>

            <div className="flex flex-col">
              <h1 className="text-[clamp(1.5rem,2.8dvw,2rem)] font-bold text-brand-navy">
                Sign in to your account
              </h1>
              <p className="text-[clamp(10px,3dvw,16px)] text-elephant">
                Enter your credentials to continue
              </p>
            </div>
          </div>
          {/* Google Button */}
          <GoogleButton />
          <p className="text-center text-[clamp(10px,3dvw,14px)] text-elephant my-4">
            Or login with email
          </p>
          <div className="flex flex-col gap-4">
            {inputs.map((input, index) => (
              <div key={index}>
                {/* For show password */}
                {input.type === "password" || input.type === "text" ? (
                  <div className="relative">
                    <input
                      key={index}
                      {...input}
                      className="w-full border-2 border-pale-silver p-2.5 pr-16 rounded-[8px] text-[clamp(10px,3dvw,14px)] bg-white focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 transition-colors"
                    />
                    {input.name === "password" && (
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-brand-navy transition-colors"
                      >
                        {showPassword ? (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.11 6.11m3.768 3.768a3.013 3.013 0 00-.16.492M17.89 17.89l-4.012-4.012m0 0a3.013 3.013 0 00.492-.16m3.52 4.172L21 21m-4.11-4.11A9.968 9.968 0 0021 12c-1.275-4.057-5.065-7-9.543-7a9.97 9.97 0 00-4.347.99"
                            />
                          </svg>
                        ) : (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                ) : (
                  <input
                    key={index}
                    {...input}
                    className="w-full border-2 border-pale-silver p-2.5 rounded-[8px] text-[clamp(10px,3dvw,14px)] bg-white focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 transition-colors"
                  />
                )}
              </div>
            ))}
          </div>
          <Turnstile key={captchaResetKey} onToken={handleCaptcha} />
        </fieldset>

        <AuthButton
          name="Login"
          user={userData}
          errorMessage="Invalid email. Please try again!"
        />

        <p className="text-center text-[clamp(10px,3dvw,14px)] text-elephant my-4 flex items-center justify-center gap-1">
          Don't have an account?
          <Link
            to="/register"
            className="text-[clamp(10px,3dvw,14px)] text-brand-gold-dark font-semibold hover:text-brand-gold hover:underline transition-colors"
          >
            Sign up here
          </Link>
        </p>
      </form>
    </div>
  );
};
