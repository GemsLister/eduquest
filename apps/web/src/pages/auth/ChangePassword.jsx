import { useState } from "react";
import eduquestLogo from "../../assets/eduquest-logo-x.png";
import { AuthButton } from "../../components/ui/buttons/Buttons.jsx";
import { Link } from "react-router-dom";

const passwordRules = [
  { label: "At least 8 characters", test: (p) => p && p.length >= 8 },
  { label: "One uppercase letter", test: (p) => p && /[A-Z]/.test(p) },
  { label: "One lowercase letter", test: (p) => p && /[a-z]/.test(p) },
  { label: "One number", test: (p) => p && /[0-9]/.test(p) },
  { label: "One special character (!@#$%^&*)", test: (p) => p && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(p) },
];

export const ChangePassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const passedRules = passwordRules.filter((r) => r.test(password)).length;
  const strengthLabel = passedRules <= 1 ? "Weak" : passedRules <= 3 ? "Fair" : passedRules <= 4 ? "Good" : "Strong";
  const strengthColor = passedRules <= 1 ? "bg-red-500" : passedRules <= 3 ? "bg-amber-500" : passedRules <= 4 ? "bg-yellow-400" : "bg-green-500";

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

  const userData = { password, confirmPassword };

  return (
    <div className="flex items-center justify-center h-screen flex-1 bg-[url('/src/assets/bg.svg')] bg-cover bg-center p-[clamp(100px,20dvw,180px)]">
      <form className="p-[clamp(30px,2dvw,80px)] bg-full-white rounded-[15px] shadow-2xl">
        <fieldset className="flex flex-col w-[clamp(330px,30dvw,400px)]">
          {/* Logo */}
          <div className="flex flex-col mb-5 gap-15">
            <img
              src={eduquestLogo}
              alt="eduquest-logo"
              className="w-[clamp(120px,19dvw,165px)]"
            />
            <div className="flex flex-col">
              <h1 className="text-[clamp(1.5rem,2.8dvw,2rem)] font-bold text-sea-green">
                Change Password
              </h1>
              <p className="text-[clamp(10px,3dvw,16px)] text-elephant">
                Keep Your Account Secure
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {/* New Password */}
            <div className="flex flex-col gap-1.5">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border-2 border-pale-silver p-2.5 pr-10 rounded-[8px] text-[clamp(10px,3dvw,14px)] focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-elephant"
                >
                  <EyeIcon show={showPassword} />
                </button>
              </div>

              {/* Strength meter */}
              {password && (
                <div className="flex flex-col gap-1 mt-1">
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className={`h-1.5 flex-1 rounded-full transition-all ${i < passedRules ? strengthColor : "bg-gray-200"}`}
                      />
                    ))}
                  </div>
                  <span className={`text-xs font-medium ${passedRules <= 1 ? "text-red-500" : passedRules <= 3 ? "text-amber-500" : passedRules <= 4 ? "text-yellow-500" : "text-green-600"}`}>
                    {strengthLabel}
                  </span>
                  <ul className="space-y-0.5 mt-1">
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

            {/* Confirm Password */}
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full border-2 p-2.5 pr-10 rounded-[8px] text-[clamp(10px,3dvw,14px)] focus:outline-none focus:ring-2 transition-colors ${confirmPassword && password !== confirmPassword ? "border-red-400 focus:border-red-400 focus:ring-red-100" : "border-pale-silver focus:border-brand-gold focus:ring-brand-gold/20"}`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-elephant"
              >
                <EyeIcon show={showConfirm} />
              </button>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-red-500 text-xs mt-1">Passwords do not match</p>
              )}
            </div>
          </div>
        </fieldset>

        <div className="flex flex-col gap-3 mt-2">
          <AuthButton name="Change Password" user={userData} />
          <Link to="/recover-password">
            <button className="border-2 border-pale-silver hover:bg-fur-white text-elephant p-2.5 rounded-[8px] text-[clamp(10px,3dvw,14px)] w-full">
              Back
            </button>
          </Link>
        </div>
      </form>
    </div>
  );
};