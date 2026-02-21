import { createBrowserRouter } from "react-router-dom";
import App from "../App";
import { ProtectedRoute } from "../components/ProtectedRoute.jsx";
// Auth Routes
import { Login } from "../pages/auth/Login.jsx";
import { Register } from "../pages/auth/Register.jsx";
import { RecoverPassword } from "../pages/auth/RecoverPassword.jsx";
import { ChangePassword } from "../pages/auth/ChangePassword.jsx";
// Instructor Routes
import { InstructorLayout } from "../pages/instructors/InstructorLayout.jsx";
import { InstructorDashboard } from "../pages/instructors/InstructorDashboard.jsx";
import { InstructorQuiz } from "../pages/instructors/InstructorQuiz.jsx";
import { InstructorQuestions } from "../pages/instructors/InstructorQuestions.jsx";
import { InstructorProfile } from "../pages/instructors/InstructorProfile.jsx";
import { SectionDetail } from "../pages/instructors/SectionDetail.jsx";
import { QuizResults } from "../pages/instructors/quizzes/QuizResults.jsx";
import { QuizResultDetail } from "../pages/instructors/quizzes/QuizResultDetail.jsx";
// Student Routes
import { StudentLayout } from "../pages/students/StudentLayout.jsx";
import { StudentDashboard } from "../pages/students/StudentDashboard.jsx";
import { StudentQuiz } from "../pages/students/StudentQuiz.jsx";
import { StudentScores } from "../pages/students/StudentScores.jsx";
import { StudentSummaries } from "../pages/students/StudentSummaries.jsx";
import { StudentProfile } from "../pages/students/StudentProfile.jsx";
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
              <InstructorLayout />
            </ProtectedRoute>
          ),
          children: [
            {
              index: true,
              element: <InstructorDashboard />,
            },
            {
              path: "section/:sectionId",
              element: <SectionDetail />,
            },
            {
              path: "instructor-quiz",
              element: <InstructorQuiz />,
            },
            {
              path: "instructor-quiz/:quizId",
              element: <InstructorQuiz />,
            },
            {
              path: "quiz-results/:quizId",
              element: <QuizResults />,
            },
            {
              path: "quiz-results/:quizId/attempt/:attemptId",
              element: <QuizResultDetail />,
            },
            {
              path: "instructor-questions",
              element: <InstructorQuestions />,
            },
            {
              path: "instructor-profile",
              element: <InstructorProfile />,
            },
          ],
        },
        // For student routing
        {
          path: "student-dashboard",
          element: (
            <ProtectedRoute>
              <StudentLayout />
            </ProtectedRoute>
          ),
          children: [
            {
              index: true,
              element: <StudentDashboard />,
            },
            {
              path: "student-quiz",
              element: <StudentQuiz />,
            },
            {
              path: "student-scores",
              element: <StudentScores />,
            },
            {
              path: "student-summaries",
              element: <StudentSummaries />,
            },
            {
              path: "student-profile",
              element: <StudentProfile />,
            },
          ],
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
