import { useState } from "react";
import eduquestLogo from "../../assets/eduquest-logo-x.png";
import { AuthButton } from "../../components/ui/buttons/Buttons.jsx";
import { Link } from "react-router-dom";

export const Register = () => {
  const [username, setUsername] = useState();
  const [email, setEmail] = useState();
  const [password, setPassword] = useState();
  const [confirmPassword, setConfirmPassword] = useState();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
  const userData = { username, email, password, confirmPassword };
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
                Get Started
              </h1>
              <p className="text-[clamp(10px,3dvw,16px)] text-elephant">
                Let's create your account
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-5">
            {inputs.map((input, index) => (
              <div key={index}>
                {input.name === "password" ||
                input.name === "confirmPassword" ? (
                  <div className="relative">
                    <input
                      {...input}
                      className="w-full border-2 border-pale-silver p-2.5 pr-16 rounded-[8px] text-[clamp(10px,3dvw,14px)]"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        input.name === "password"
                          ? setShowPassword(!showPassword)
                          : setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-elephant hover:text-sea-green transition-colors text-sm"
                    >
                      {input.name === "password"
                        ? showPassword
                          ? "Hide"
                          : "Show"
                        : showConfirmPassword
                          ? "Hide"
                          : "Show"}
                    </button>
                  </div>
                ) : (
                  <input
                    {...input}
                    className="w-full border-2 border-pale-silver p-2.5 rounded-[8px] text-[clamp(10px,3dvw,14px)]"
                  />
                )}
              </div>
            ))}
          </div>
        </fieldset>
        <AuthButton name="Register" user={userData} />
        <p className="text-center text-[clamp(10px,3dvw,14px)] text-elephant my-4 flex items-center justify-center gap-1">
          Already have an account?
          <Link
            to="/"
            className="text-[clamp(10px,3dvw,14px)] text-dark-aquamarine-green"
          >
            Login here
          </Link>
        </p>
      </form>
    </div>
  );
};
