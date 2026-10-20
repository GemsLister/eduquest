import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient.js";
import { useAuth } from "../context/AuthContext.jsx";

const EMPTY = { googleName: "", dbName: "", avatarUrl: "" };

export const useUsername = () => {
  const { user } = useAuth();
  // Tagged with the user it was loaded for, so a stale profile is never shown
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    if (!user) return;

    const getUserData = async () => {
      const googleName =
        user.user_metadata?.full_name || user.email.split("@")[0];
      const { data: dbRecord } = await supabase
        .from("profiles")
        .select("username, avatar_url, first_name, last_name")
        .eq("id", user.id)
        .maybeSingle();

      const fullName =
        dbRecord?.first_name && dbRecord?.last_name
          ? `${dbRecord.first_name} ${dbRecord.last_name}`
          : null;

      setUserData({
        userId: user.id,
        googleName: fullName || googleName,
        dbName: dbRecord ? dbRecord.username : "",
        avatarUrl: dbRecord?.avatar_url || "",
      });
    };
    getUserData();

    // Refresh when the profile page saves a new name or picture
    window.addEventListener("profile-updated", getUserData);
    return () => window.removeEventListener("profile-updated", getUserData);
  }, [user]);

  if (!user) return { ...EMPTY, loading: false };
  if (userData?.userId !== user.id) return { ...EMPTY, loading: true };
  return { ...userData, loading: false };
};
