import { supabase } from "../../supabaseClient.js";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GoogleButton } from "../../components/Buttons.jsx";
import eduquestLogo from "../../assets/eduquest-logo-x.png";
import { ShowPassword } from "../../components/Buttons.jsx";

export const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const inputs = [
    {
      type: "email",
      name: "email",
      id: "email",
      placeholder: "Enter your email",
      onChange: (e) => setEmail(e.target.value),
      value: email,
    },
    {
      type: showPassword ? "text" : "password",
      name: "password",
      id: "password",
      placeholder: `Enter your password`,
      onChange: (e) => setPassword(e.target.value),
      value: password,
    },
  ];

  const validateForm = () => {
    if (!email.trim()) {
      setError("Email is required");
      return false;
    }
    if (!password) {
      setError("Password is required");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email");
      return false;
    }
    return true;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword(
        {
          email,
          password,
        },
      );

      if (authError) {
        if (authError.message.includes("Invalid login credentials")) {
          setError("Invalid email or password");
        } else {
          setError(authError.message);
        }
        setLoading(false);
        return;
      }

      if (data?.user) {
        navigate("/instructor-dashboard");
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      console.error("Login error:", err);
      setLoading(false);
    }
  };
  return (
    <div className="flex items-center justify-center h-screen w-screen bg-[url('/src/assets/bg.svg')] bg-cover bg-center">
      <form
        onSubmit={handleLogin}
        className="p-[clamp(30px,2dvw,80px)] bg-full-white rounded-[15px] shadow-2xl"
      >
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
                Welcome back!
              </h1>
              <p className="text-[clamp(10px,3dvw,16px)] text-elephant">
                Enter your details to continue
              </p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 rounded-[8px]">
              <p className="text-red-700 text-[clamp(10px,3dvw,14px)]">
                {error}
              </p>
            </div>
          )}

          {/* Google Button */}
          <GoogleButton />

          <p className="text-center text-[clamp(10px,3dvw,14px)] text-elephant my-4">
            Or login with email
          </p>
          <div className="flex flex-col gap-4">
            {inputs.map((input, index) => (
              <div key={index}>
                {input.type === "password" || input.type === "text" ? (
                  <div className="relative">
                    <input
                      key={index}
                      {...input}
                      className="w-full border-2 border-pale-silver p-2.5 rounded-[8px] text-[clamp(10px,3dvw,14px)]"
                      disabled={loading}
                    />
                    {input.name === "password" && (
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-elephant hover:text-sea-green transition-colors"
                      >
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    )}
                  </div>
                ) : (
                  <input
                    key={index}
                    {...input}
                    className="w-full border-2 border-pale-silver p-2.5 rounded-[8px] text-[clamp(10px,3dvw,14px)]"
                    disabled={loading}
                  />
                )}
              </div>
            ))}

            <div className="flex justify-end text-[clamp(10px,3dvw,14px)] text-elephant">
              <Link to="/recover-password">Forgot password?</Link>
            </div>
          </div>
        </fieldset>

        {/* Login Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full mt-6 p-2.5 bg-sea-green text-full-white rounded-[8px] font-semibold text-[clamp(10px,3dvw,14px)] hover:bg-dark-aquamarine-green disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-full-white"></div>
              Logging in...
            </>
          ) : (
            "Login"
          )}
        </button>

        <p className="text-center text-[clamp(10px,3dvw,14px)] text-elephant my-4 flex items-center justify-center gap-1">
          Don't have an account?
          <Link
            to="/register"
            className="text-[clamp(10px,3dvw,14px)] text-dark-aquamarine-green font-semibold hover:underline"
          >
            Register here
          </Link>
        </p>
      </form>
    </div>
  );
};
