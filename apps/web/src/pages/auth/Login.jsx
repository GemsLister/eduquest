import { supabase } from "../../supabaseClient.js";
import { GoogleButton } from "../../components/Buttons.jsx";

export const Login = () => {
  return (
    <div className="grid grid-cols-2 h-screen">
      <form action="" className="bg-amber-300 h-full"></form>

      {/* Overlayer */}

      <div className="relative flex bg-[url('/src/assets/bgimage.jpg')] h-full bg-cover bg-center">
        <div className="absolute inset-0 bg-black/50 col-end-2 w-[.5fr]"></div>
      </div>
    </div>
  );
};
