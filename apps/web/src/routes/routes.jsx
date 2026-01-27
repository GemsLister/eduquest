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
// import { Layout } from "../components/Layout.jsx";
import { InstructorLayout } from "../pages/instructors/InstructorLayout.jsx";
import { ProtectedRoute } from "../components/ProtectedRoute.jsx";
import { StudentDashboard } from "../pages/students/StudentDashboard.jsx";

export const router = createBrowserRouter([
  // For authentication routing
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
      // For instructor routing
      {
        path: "instructor-dashboard",
        element: (
          <ProtectedRoute>
            <InstructorLayout />
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
            <InstructorLayout/> 
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
            <InstructorLayout/> 
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
            <InstructorLayout/>
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
  // For student routing
  // {
  //   path: "student-dashboard",
  //   element: (
  //     <ProtectedRoute>
  //       <InstructorLayout/> />
  //     </ProtectedRoute>
  //   ),
  //   children: [
  //     {
  //       index: true,
  //       element: <StudentDashboard />,
  //     },
  //   ],
  // }
]);
