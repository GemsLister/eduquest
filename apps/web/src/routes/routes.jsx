import { createBrowserRouter } from "react-router-dom";
import App from "../App";
import { ProtectedRoute } from "../components/ProtectedRoute.jsx";
// Auth Routes
import * as AuthIndex from "../pages/auth/authIndex.js";
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
          element: <AuthIndex.Login />,
        },
        {
          path: "register",
          element: <AuthIndex.Register />,
        },
        {
          path: "recover-password",
          element: <AuthIndex.RecoverPassword />,
        },
        {
          path: "change-password",
          element: <AuthIndex.ChangePassword />,
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
      ],
    },
  ],
  {
    future: {
      v7_startTransition: true,
    },
  },
);
