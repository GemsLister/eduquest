import { useState, useCallback } from "react";
import citlLogo from "../../assets/BUKSU_CITL.jpg";
import { AuthButton } from "../../components/ui/buttons/Buttons.jsx";
import { Turnstile } from "../../components/Turnstile.jsx";
import { Link } from "react-router-dom";

export const Register = () => {
  const [username, setUsername] = useState();
  const [email, setEmail] = useState();
  const [password, setPassword] = useState();
  const [confirmPassword, setConfirmPassword] = useState();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState(null);
  const handleCaptcha = useCallback((token) => setCaptchaToken(token), []);

  const inputs = [
    {
      type: "text",
      name: "username",
      placeholder: "Enter your full name",
      onChange: (e) => setUsername(e.target.value),
    },
    {
      type: "email",
      name: "email",
      placeholder: "name@buksu.edu.ph",
      onChange: (e) => setEmail(e.target.value),
    },
    {
      type: showPassword ? "text" : "password",
      name: "password",
      placeholder: "Enter your password",
      onChange: (e) => setPassword(e.target.value),
    },
    {
      type: showConfirmPassword ? "text" : "password",
      name: "confirmPassword",
      placeholder: "Confirm your password",
      onChange: (e) => setConfirmPassword(e.target.value),
    },
  ];
  const userData = { username, email, password, confirmPassword, captchaToken };

  const passwordRules = [
    { label: "At least 8 characters", test: (p) => p && p.length >= 8 },
    { label: "One uppercase letter", test: (p) => p && /[A-Z]/.test(p) },
    { label: "One lowercase letter", test: (p) => p && /[a-z]/.test(p) },
    { label: "One number", test: (p) => p && /[0-9]/.test(p) },
    { label: "One special character (!@#$%^&*)", test: (p) => p && /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p) },
  ];

  const passedRules = passwordRules.filter((r) => r.test(password)).length;
  const strengthLabel = passedRules <= 1 ? "Weak" : passedRules <= 3 ? "Fair" : passedRules <= 4 ? "Good" : "Strong";
  const strengthColor = passedRules <= 1 ? "bg-red-500" : passedRules <= 3 ? "bg-amber-500" : passedRules <= 4 ? "bg-brand-gold" : "bg-green-500";

  const EyeIcon = ({ show }) =>
    show ? (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.11 6.11m3.768 3.768a3.013 3.013 0 00-.16.492M17.89 17.89l-4.012-4.012m0 0a3.013 3.013 0 00.492-.16m3.52 4.172L21 21m-4.11-4.11A9.968 9.968 0 0021 12c-1.275-4.057-5.065-7-9.543-7a9.97 9.97 0 00-4.347.99" />
      </svg>
    ) : (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    );

  return (
    <div className="flex items-center justify-center min-h-screen flex-1 bg-brand-navy py-8 px-4">
      <form className="p-[clamp(30px,2dvw,80px)] bg-full-white rounded-[15px] shadow-2xl border-t-4 border-brand-gold my-auto">
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
                Create your account
              </h1>
              <p className="text-[clamp(10px,3dvw,16px)] text-elephant">
                Fill in your details to get started
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-5">
            {inputs.map((input, index) => (
              <div key={index}>
                {input.name === "password" ||
                input.name === "confirmPassword" ? (
                  <div>
                    <div className="relative">
                      <input
                        {...input}
                        className="w-full border-2 border-pale-silver p-2.5 pr-16 rounded-[8px] text-[clamp(10px,3dvw,14px)] bg-white focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          input.name === "password"
                            ? setShowPassword(!showPassword)
                            : setShowConfirmPassword(!showConfirmPassword)
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-navy transition-colors"
                      >
                        <EyeIcon
                          show={
                            input.name === "password"
                              ? showPassword
                              : showConfirmPassword
                          }
                        />
                      </button>
                    </div>
                    {/* Password strength indicator */}
                    {input.name === "password" && password && (
                      <div className="mt-2">
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="flex-1 flex gap-1">
                            {[...Array(5)].map((_, i) => (
                              <div
                                key={i}
                                className={`h-1 flex-1 rounded-full transition-colors ${i < passedRules ? strengthColor : "bg-gray-200"}`}
                              />
                            ))}
                          </div>
                          <span className={`text-[11px] font-semibold ${passedRules <= 1 ? "text-red-500" : passedRules <= 3 ? "text-amber-500" : passedRules <= 4 ? "text-brand-gold-dark" : "text-green-600"}`}>
                            {strengthLabel}
                          </span>
                        </div>
                        <ul className="space-y-0.5">
                          {passwordRules.map((rule, i) => (
                            <li key={i} className={`text-[11px] flex items-center gap-1.5 ${rule.test(password) ? "text-green-600" : "text-gray-400"}`}>
                              {rule.test(password) ? (
                                <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                              ) : (
                                <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><circle cx="12" cy="12" r="5" /></svg>
                              )}
                              {rule.label}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <input
                    {...input}
                    className="w-full border-2 border-pale-silver p-2.5 rounded-[8px] text-[clamp(10px,3dvw,14px)] bg-white focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 transition-colors"
                  />
                )}
              </div>
            ))}
          </div>
          <Turnstile onToken={handleCaptcha} />
        </fieldset>
        <AuthButton name="Register" user={userData} />
        <p className="text-center text-[clamp(10px,3dvw,14px)] text-elephant my-4 flex items-center justify-center gap-1">
          Already have an account?
          <Link
            to="/"
            className="text-[clamp(10px,3dvw,14px)] text-brand-gold-dark font-semibold hover:text-brand-gold hover:underline transition-colors"
          >
            Login here
          </Link>
        </p>
      </form>
    </div>
  );
};
