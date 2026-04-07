import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../supabaseClient.js";
import { useAuth } from "../context/AuthContext.jsx";

export const ProtectedRoute = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isFacultyHead, setIsFacultyHead] = useState(false);
  const [isApproved, setIsApproved] = useState(null);
  const [isDisabled, setIsDisabled] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setProfileLoading(false);
      return;
    }

    const checkProfile = async () => {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();
        setIsAdmin(!!profile?.is_admin);
        setIsFacultyHead(!!profile?.is_faculty_head);
        // Treat null (column not yet added) as approved to avoid locking out existing users
        setIsApproved(profile?.is_approved !== false);
        setIsDisabled(profile?.is_disabled === true);

        if (profile?.is_disabled === true) {
          await supabase.auth.signOut();
        }
      } catch (error) {
        console.error("Auth check error:", error);
      } finally {
        setProfileLoading(false);
      }
    };

    checkProfile();
  }, [user, authLoading]);

  if (authLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center h-screen flex-1">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sea-green mx-auto mb-4"></div>
          <p className="text-elephant">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (isDisabled) {
    return <Navigate to="/" replace />;
  }

  if (isAdmin) {
    return <Navigate to="/admin-dashboard" replace />;
  }

  if (isFacultyHead) {
    return <Navigate to="/faculty-head-dashboard" replace />;
  }

  if (!isApproved) {
    return (
      <div className="flex items-center justify-center h-screen flex-1 bg-gray-50">
        <div className="bg-white rounded-xl shadow-lg p-10 max-w-md w-full text-center">
          <div className="text-5xl mb-4">⏳</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Pending Approval
          </h1>
          <p className="text-gray-500 text-sm">
            Your account registration is being reviewed by the admin. You will
            be able to log in once your account has been approved.
          </p>
          <button
            onClick={() =>
              supabase.auth.signOut().then(() => (window.location.href = "/"))
            }
            className="mt-6 px-6 py-2.5 bg-casual-green text-white rounded-lg font-semibold text-sm hover:bg-hornblende-green transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return children;
};
