import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../supabaseClient.js";
import { useAuth } from "../context/AuthContext.jsx";

export const AdminProtectedRoute = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState("loading"); // "loading" | "admin" | "unauthorized"

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setStatus("unauthorized");
      return;
    }

    const checkAdmin = async () => {
      try {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError || !profile?.is_admin) {
          setStatus("unauthorized");
          return;
        }

        setStatus("admin");
      } catch {
        setStatus("unauthorized");
      }
    };

    checkAdmin();
  }, [user, authLoading]);

  if (authLoading || status === "loading") {
    return (
      <div className="flex items-center justify-center h-screen flex-1">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sea-green mx-auto mb-4"></div>
          <p className="text-elephant">Verifying Senior Faculty access...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthorized") {
    return <Navigate to="/" replace />;
  }

  return children;
};
