import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../supabaseClient.js";

export const AdminProtectedRoute = ({ children }) => {
  const [status, setStatus] = useState("loading"); // "loading" | "admin" | "unauthorized"

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          setStatus("unauthorized");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", user.id)
          .single();

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
  }, []);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-screen flex-1">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sea-green mx-auto mb-4"></div>
          <p className="text-elephant">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthorized") {
    return <Navigate to="/" replace />;
  }

  return children;
};
