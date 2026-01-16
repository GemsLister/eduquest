import { createBrowserRouter } from "react-router";
import App from "../App";
import { Login } from "../pages/auth/Login.jsx";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: <Login />,
      },
    ],
  },
]);
