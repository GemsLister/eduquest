import { createBrowserRouter } from "react-router-dom";
import App from "../App";
import { ProtectedRoute } from "../components/ProtectedRoute.jsx";
import { AdminProtectedRoute } from "../components/AdminProtectedRoute.jsx";
import { FacultyHeadProtectedRoute } from "../components/FacultyHeadProtectedRoute.jsx";
// Auth Routes
import * as AuthIndex from "../pages/auth/authIndex.js";
// Instructor Routes
import * as InstructorIndex from "../pages/instructors/instructorPageIndex.js";
// Item Analysis Routes
import { ItemAnalysisPage } from "../pages/item-analysis/ItemAnalysisPage.jsx";
// Senior Faculty Routes
import * as AdminIndex from "../pages/admin/adminPageIndex.js";
// Department Head Routes
import * as FacultyHeadIndex from "../pages/faculty-head/facultyHeadPageIndex.js";
// Public Routes
import { PublicQuizPage } from "../pages/PublicQuizPage.jsx";
import { Layout } from "../components/container/Layout.jsx";
import { AdminLayout } from "../components/container/AdminLayout.jsx";
import { FacultyHeadLayout } from "../components/container/FacultyHeadLayout.jsx";

const NotFoundPage = () => (
  <div className="flex flex-col items-center justify-center h-screen bg-brand-navy text-white gap-6">
    <div className="text-8xl font-bold text-brand-gold">404</div>
    <h1 className="text-2xl font-semibold">Page Not Found</h1>
    <p className="text-sm text-gray-400 max-w-xs text-center">
      The page you are looking for does not exist or has been moved.
    </p>
    <a
      href="/"
      className="mt-2 px-6 py-2.5 bg-brand-gold text-brand-navy font-semibold rounded-lg hover:bg-yellow-400 transition-colors"
    >
      Back to Login
    </a>
  </div>
);

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
              <Layout />
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
              path: "quizzes",
              element: <InstructorIndex.QuizzesPageMain />,
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
              path: "question-bank",
              element: <InstructorIndex.QuestionBank />,
            },
            {
              path: "question-bank/:quizId",
              element: <InstructorIndex.QuestionBank />,
            },
            {
              path: "instructor-profile",
              element: <InstructorIndex.InstructorProfile />,
            },
            {
              path: "item-difficulty-analysis",
              element: <ItemAnalysisPage />,
            },
            {
              path: "student-profiles",
              element: <InstructorIndex.StudentProfiles />,
            },
            {
              path: "my-submissions",
              element: <InstructorIndex.MySubmissions />,
            },
            {
              path: "history",
              element: <InstructorIndex.History />,
            },
            {
              path: "quiz-versions",
              element: <InstructorIndex.QuizVersions />,
            },
            {
              path: "saved-analysis",
              element: <InstructorIndex.SavedAnalysisPage />,
            },
            {
              path: "peer-reviews",
              element: <InstructorIndex.PeerReviews />,
            },
            {
              path: "peer-reviews/:submissionId",
              element: <InstructorIndex.PeerReviewDetail />,
            },
          ],
        },
        // Senior Faculty dashboard routing
        {
          path: "admin-dashboard",
          element: (
            <AdminProtectedRoute>
              <AdminLayout />
            </AdminProtectedRoute>
          ),
          children: [
            {
              index: true,
              element: <AdminIndex.AdminDashboard />,
            },
            {
              path: "subjects",
              element: <InstructorIndex.InstructorDashboard />,
            },
            {
              path: "section/:sectionId",
              element: <InstructorIndex.SectionDetail />,
            },
            {
              path: "instructors",
              element: <AdminIndex.AdminInstructors />,
            },
            {
              path: "create-instructor",
              element: <AdminIndex.AdminCreateInstructor />,
            },
            {
              path: "registration-requests",
              element: <AdminIndex.AdminRegistrationRequests />,
            },
            {
              path: "quiz-reviews",
              element: <AdminIndex.AdminQuizReviews />,
            },
            {
              path: "quiz-reviews/:submissionId",
              element: <AdminIndex.AdminQuizReviewDetail />,
            },
            {
              path: "quizzes",
              element: <InstructorIndex.QuizzesPageMain />,
            },
            {
              path: "create-quiz",
              element: <InstructorIndex.InstructorQuiz />,
            },
            {
              path: "create-quiz/:quizId",
              element: <InstructorIndex.InstructorQuiz />,
            },
            {
              path: "my-submissions",
              element: <InstructorIndex.MySubmissions />,
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
              path: "question-bank",
              element: <InstructorIndex.QuestionBank />,
            },
            {
              path: "question-bank/:quizId",
              element: <InstructorIndex.QuestionBank />,
            },
          ],
        },
        // Department Head dashboard routing
        {
          path: "faculty-head-dashboard",
          element: (
            <FacultyHeadProtectedRoute>
              <FacultyHeadLayout />
            </FacultyHeadProtectedRoute>
          ),
          children: [
            {
              index: true,
              element: <FacultyHeadIndex.FacultyHeadDashboard />,
            },
            {
              path: "quiz-approvals",
              element: <FacultyHeadIndex.FacultyHeadQuizApprovals />,
            },
            {
              path: "quiz-approvals/:submissionId",
              element: <FacultyHeadIndex.FacultyHeadApprovalDetail />,
            },
            {
              path: "subject-requests",
              element: <FacultyHeadIndex.FacultyHeadSubjectRequests />,
            },
            {
              path: "settings",
              element: <FacultyHeadIndex.FacultyHeadSettings />,
            },
            {
              path: "audit-trail",
              element: <FacultyHeadIndex.FacultyHeadAuditTrail />,
            },
          ],
        },
      ],
    },
    // 404 catch-all route — must be last
    {
      path: "*",
      element: <NotFoundPage />,
    },
  ],
  {
    future: {
      v7_startTransition: true,
    },
  },
);
