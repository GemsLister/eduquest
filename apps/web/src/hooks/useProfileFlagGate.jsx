import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient.js";
import { useAuth } from "../context/AuthContext.jsx";

/**
 * Route-guard status for a boolean role column on the signed-in user's profile
 * (e.g. "is_admin"): "loading" | "authorized" | "unauthorized".
 */
export const useProfileFlagGate = (flag) => {
  const { user, loading: authLoading } = useAuth();
  // Tagged with the user it was checked for, so a stale answer is never reused
  const [check, setCheck] = useState(null);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    const finish = (allowed) => {
      if (!cancelled) setCheck({ userId: user.id, allowed });
    };
    supabase
      .from("profiles")
      .select(flag)
      .eq("id", user.id)
      .maybeSingle()
      .then(
        ({ data, error }) => finish(!error && !!data?.[flag]),
        () => finish(false),
      );
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, flag]);

  if (authLoading) return "loading";
  if (!user) return "unauthorized";
  if (check?.userId !== user.id) return "loading";
  return check.allowed ? "authorized" : "unauthorized";
};
