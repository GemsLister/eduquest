import { supabase } from "../../supabaseClient.js";
import { useState } from "react";
import { Link } from "react-router-dom";
import { GoogleButton, AuthButton } from "../../components/Buttons.jsx";
import eduquestLogo from "../../assets/eduquest-logo-x.png";
import { ShowPassword } from "../../components/Buttons.jsx";

export const Login = () => {
  const [email, setEmail] = useState();
  const [password, setPassword] = useState();
  const inputs = [
    {
      type: "email",
      name: "email",
      id: "email",
      placeholder: "Enter your email",
      onChange: (e) => setEmail(e.target.value),
    },
    {
      type: "password",
      name: "password",
      id: "password",
      placeholder: `Enter your password`,
      onChange: (e) => setPassword(e.target.value),
    },
  ];

  const userData = { email, password };
  return (
    <div className="flex items-center justify-center h-screen w-screen bg-[url('/src/assets/bg.svg')] bg-cover bg-center">
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
                Welcome back!
              </h1>
              <p className="text-[clamp(10px,3dvw,16px)] text-elephant">
                Enter your details to continue
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
                {input.type === "password" ? (
                  <div className="relative">
                    <input
                      key={index}
                      {...input}
                      className=" w-full border-2 border-pale-silver p-2.5 rounded-[8px] text-[clamp(10px,3dvw,14px)]"
                    />
                    <ShowPassword buttonType={input} />
                  </div>
                ) : (
                  <input
                    key={index}
                    {...input}
                    className=" w-full border-2 border-pale-silver p-2.5 rounded-[8px] text-[clamp(10px,3dvw,14px)]"
                  />
                )}
              </div>
            ))}

            <div className="flex justify-end text-[clamp(10px,3dvw,14px)] text-elephant">
              <Link to="/recover-password">Forgot password?</Link>
            </div>
          </div>
        </fieldset>
        <AuthButton name="Login" user={userData} />
        <p className="text-center text-[clamp(10px,3dvw,14px)] text-elephant my-4 flex items-center justify-center gap-1">
          Don't have an account?
          <Link
            to="/register"
            className="text-[clamp(10px,3dvw,14px)] text-dark-aquamarine-green"
          >
            Register here
          </Link>
        </p>
      </form>
    </div>
  );
};
