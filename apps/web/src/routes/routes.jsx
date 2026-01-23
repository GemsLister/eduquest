import { createBrowserRouter } from "react-router-dom";
import App from "../App";
import { Login } from "../pages/auth/Login.jsx";
import { Register } from "../pages/auth/Register.jsx";
import { RecoverPassword } from "../pages/auth/RecoverPassword.jsx";
import { ChangePassword } from "../pages/auth/ChangePassword.jsx";
import { InstructorDashboard } from "../pages/instructors/InstructorDashboard.jsx";
import { InstructorQuiz } from "../pages/instructors/InstructorQuiz.jsx";
import { InstructorQuestions } from "../pages/instructors/InstructorQuestions.jsx";
import { InstructorProfile } from "../pages/instructors/InstructorProfile.jsx";
import { Layout } from "../pages/instructors/Layout.jsx";
import { ProtectedRoute } from "../components/ProtectedRoute.jsx";

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
        path: "register",
        element: <Register />,
      },
      {
        path: "recover-password",
        element: <RecoverPassword />,
      },
      {
        path: "change-password",
        element: <ChangePassword />,
      },
      {
        path: "instructor-dashboard",
        element: (
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        ),
        children: [
          {
            index: true,
            element: <InstructorDashboard />,
          },
        ],
      },
      {
        path: "instructor-quiz",
        element: (
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        ),
        children: [
          {
            index: true,
            element: <InstructorQuiz />,
          },
        ],
      },
      {
        path: "instructor-questions",
        element: (
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        ),
        children: [
          {
            index: true,
            element: <InstructorQuestions />,
          },
        ],
      },
      {
        path: "instructor-profile",
        element: (
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        ),
        children: [
          {
            index: true,
            element: <InstructorProfile />,
          },
        ],
      },
    ],
  },
]);
