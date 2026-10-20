import { Navigate } from "react-router-dom";
import { useProfileFlagGate } from "../hooks/useProfileFlagGate.jsx";

export const FacultyHeadProtectedRoute = ({ children }) => {
  const status = useProfileFlagGate("is_faculty_head");

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-screen flex-1">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sea-green mx-auto mb-4"></div>
          <p className="text-elephant">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthorized") {
    return <Navigate to="/" replace />;
  }

  return children;
};
