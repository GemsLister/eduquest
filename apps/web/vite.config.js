import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // resolve: {
  //   alias: {
  //     // force all imports to use the root react
  //     react: path.resolve(__dirname, "../../node_modules/react"),
  //     "react-dom": path.resolve(__dirname, "../../node_modules/react-dom"),
  //   },
  // },
});
