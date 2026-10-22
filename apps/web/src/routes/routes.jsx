import { createBrowserRouter, Navigate } from "react-router-dom";
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
import { NotFoundPage } from "../pages/NotFoundPage.jsx";
import { LegacyExamRedirect } from "../components/LegacyExamRedirect.jsx";

export const router = createBrowserRouter(
  [
    // Public exam route (no authentication required)
    {
      path: "/exam/:shareToken",
      element: <PublicQuizPage />,
    },
    {
      // Exam links shared before the quiz-to-exam rename
      path: "/quiz/*",
      element: <LegacyExamRedirect />,
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
              path: "exams",
              element: <InstructorIndex.QuizzesPageMain />,
            },
            {
              path: "instructor-exam",
              element: <InstructorIndex.InstructorQuiz />,
            },
            {
              path: "instructor-exam/:quizId",
              element: <InstructorIndex.InstructorQuiz />,
            },
            {
              path: "exam-results/:quizId",
              element: <InstructorIndex.QuizResults />,
            },
            {
              path: "exam-results/:quizId/attempt/:attemptId",
              element: <InstructorIndex.QuizResultDetail />,
            },
            // Old "quiz" URLs (saved notifications, bookmarks)
            { path: "quizzes", element: <LegacyExamRedirect /> },
            { path: "instructor-quiz/*", element: <LegacyExamRedirect /> },
            { path: "quiz-results/*", element: <LegacyExamRedirect /> },
            {
              // Replaced by the Question Bank
              path: "instructor-questions",
              element: <Navigate to="/instructor-dashboard/question-bank" replace />,
            },
            {
              path: "question-bank",
              element: <InstructorIndex.QuestionBank />,
            },
            {
              // Import-to-quiz mode was replaced by the quiz editor's Question Bank modal
              path: "question-bank/:quizId",
              element: <Navigate to="/instructor-dashboard/question-bank" replace />,
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
              // The peer review list lives under My Submissions
              path: "peer-reviews",
              element: <Navigate to="/instructor-dashboard/my-submissions?tab=peer_reviews" replace />,
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
              path: "instructors/:instructorId",
              element: <AdminIndex.AdminInstructorDetail />,
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
              path: "exam-reviews",
              element: <AdminIndex.AdminQuizReviews />,
            },
            {
              path: "exam-reviews/:submissionId",
              element: <AdminIndex.AdminQuizReviewDetail />,
            },
            {
              path: "exams",
              element: <InstructorIndex.QuizzesPageMain />,
            },
            {
              path: "create-exam",
              element: <InstructorIndex.InstructorQuiz />,
            },
            {
              path: "create-exam/:quizId",
              element: <InstructorIndex.InstructorQuiz />,
            },
            // Old "quiz" URLs (saved notifications, bookmarks)
            { path: "quiz-reviews/*", element: <LegacyExamRedirect /> },
            { path: "quizzes", element: <LegacyExamRedirect /> },
            { path: "create-quiz/*", element: <LegacyExamRedirect /> },
            { path: "quiz-results/*", element: <LegacyExamRedirect /> },
            {
              path: "my-submissions",
              element: <InstructorIndex.MySubmissions />,
            },
            {
              path: "exam-results/:quizId",
              element: <InstructorIndex.QuizResults />,
            },
            {
              path: "exam-results/:quizId/attempt/:attemptId",
              element: <InstructorIndex.QuizResultDetail />,
            },
            {
              path: "question-bank",
              element: <InstructorIndex.QuestionBank />,
            },
            {
              // Import-to-quiz mode was replaced by the quiz editor's Question Bank modal
              path: "question-bank/:quizId",
              element: <Navigate to="/admin-dashboard/question-bank" replace />,
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
              path: "profile",
              element: <InstructorIndex.InstructorProfile />,
            },
            {
              // Same page as the Department Head's, read-only for both
              path: "audit-trail",
              element: <FacultyHeadIndex.FacultyHeadAuditTrail />,
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
              path: "exam-approvals",
              element: <FacultyHeadIndex.FacultyHeadQuizApprovals />,
            },
            {
              path: "exam-approvals/:submissionId",
              element: <FacultyHeadIndex.FacultyHeadApprovalDetail />,
            },
            // Old "quiz" URLs (saved notifications, bookmarks)
            { path: "quiz-approvals/*", element: <LegacyExamRedirect /> },
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
            {
              path: "profile",
              element: <InstructorIndex.InstructorProfile />,
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
