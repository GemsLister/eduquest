import { useState } from "react";
import eduquestLogo from "../../assets/eduquest-logo-x.png";
import { AuthButton } from "../../components/Buttons.jsx";
import { Link } from "react-router-dom";

export const ChangePassword = () => {
  const [email, setEmail] = useState();
  return (
    <div className="flex items-center justify-center h-screen w-screen bg-[url('/src/assets/bg.svg')] bg-cover bg-center p-[clamp(100px,20dvw,180px)]">
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
          <div className="flex flex-col gap-5">
            <input
              type="password"
              placeholder="Enter new password"
              onChange={(e) => setEmail(e.target.value)}
              className="border-2 border-pale-silver p-2.5 rounded-[8px] text-[clamp(10px,3dvw,14px)]"
            />
          </div>
        </fieldset>
        <div className="flex flex-col gap-3">
          <AuthButton name="Change Password" user={email} />
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
