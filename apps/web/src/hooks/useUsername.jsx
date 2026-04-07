import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient.js";
import { useAuth } from "../context/AuthContext.jsx";

export const useUsername = () => {
  const { user } = useAuth();
  const [userData, setUserData] = useState({
    googleName: "",
    dbName: "",
    avatarUrl: "",
    loading: true,
  });

  useEffect(() => {
    if (!user) {
      setUserData({ googleName: "", dbName: "", avatarUrl: "", loading: false });
      return;
    }

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
        googleName: fullName || googleName,
        dbName: dbRecord ? dbRecord.username : "",
        avatarUrl: dbRecord?.avatar_url || "",
        loading: false,
      });
    };
    getUserData();
  }, [user]);

  return userData;
};
