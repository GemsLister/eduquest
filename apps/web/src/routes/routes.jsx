import { createBrowserRouter } from "react-router-dom";
import App from "../App";
import { ProtectedRoute } from "../components/ProtectedRoute.jsx";
// Auth Routes
import { Login } from "../pages/auth/Login.jsx";
import { Register } from "../pages/auth/Register.jsx";
import { RecoverPassword } from "../pages/auth/RecoverPassword.jsx";
import { ChangePassword } from "../pages/auth/ChangePassword.jsx";
// Instructor Routes
import * as InstructorIndex from "../pages/instructors/instructorPageIndex.js";
// Public Routes
import { PublicQuizPage } from "../pages/PublicQuizPage.jsx";

export const router = createBrowserRouter(
  [
    // Public quiz route (no authentication required)
    {
      path: "/quiz/:shareToken",
      element: <PublicQuizPage />,
    },
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
              <InstructorIndex.InstructorLayout />
            </ProtectedRoute>
          ),
          children: [
            {
              index: true,
              element: <InstructorIndex.InstructorDashboard />,
            },
            {
              path: "section/:sectionId",
              element: <InstructorIndex.SectionDetail />,
            },
            {
              path: "instructor-quiz",
              element: <InstructorIndex.InstructorQuiz />,
            },
            {
              path: "instructor-quiz/:quizId",
              element: <InstructorIndex.InstructorQuiz />,
            },
            {
              path: "quiz-results/:quizId",
              element: <InstructorIndex.QuizResults />,
            },
            {
              path: "quiz-results/:quizId/attempt/:attemptId",
              element: <InstructorIndex.QuizResultDetail />,
            },
            {
              path: "instructor-questions",
              element: <InstructorIndex.InstructorQuestions />,
            },
            {
              path: "instructor-profile",
              element: <InstructorIndex.InstructorProfile />,
            },
          ],
        },
        {
          path: "instructor-dashboard",
        },
        // For student routing
        // {
        //   path: "student-dashboard",
        //   element: (
        //     <ProtectedRoute>
        //       <StudentLayout />
        //     </ProtectedRoute>
        //   ),
        //   children: [
        //     {
        //       index: true,
        //       element: <StudentDashboard />,
        //     },
        //     {
        //       path: "student-quiz",
        //       element: <StudentQuiz />,
        //     },
        //     {
        //       path: "student-scores",
        //       element: <StudentScores />,
        //     },
        //     {
        //       path: "student-summaries",
        //       element: <StudentSummaries />,
        //     },
        //     {
        //       path: "student-profile",
        //       element: <StudentProfile />,
        //     },
        //   ],
        // },
      ],
    },
  ],
  {
    future: {
      v7_startTransition: true,
    },
  },
);
