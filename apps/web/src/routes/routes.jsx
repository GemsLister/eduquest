import { createBrowserRouter } from "react-router";
import App from "../App";
import { Login } from "../pages/auth/Login.jsx";
import { Register } from "../pages/auth/Register.jsx";
import { RecoverPassword } from "../pages/auth/RecoverPassword.jsx";
import { ChangePassword } from "../pages/auth/ChangePassword.jsx";
import { InstructorDashboard } from "../pages/instructors/InstructorDashboard.jsx";
import { InstructorQuiz } from "../pages/instructors/InstructorQuiz.jsx";
import { Layout } from "../pages/instructors/Layout.jsx";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: <Login />,
      },
      {
        path: "/register",
        element: <Register />,
      },
      {
        path: "/recover-password",
        element: <RecoverPassword />,
      },
      {
        path: "/change-password",
        element: <ChangePassword />,
      },
    ],
  },
  {
    element: <Layout />,
    children: [
      {
        path: "/instructor-dashboard/",
        element: <InstructorDashboard />,
      },
      {
        path: "/instructor-quiz",
        element: <InstructorQuiz />,
      },
    ],
  },
]);
