import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient.js";

export const useUsername = () => {
  const [userData, setUserData] = useState({
    googleName: "",
    dbName: "",
    loading: true,
  });

  useEffect(() => {
    const getUserData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Get the user's full name from Google
        const googleName =
          user.user_metadata?.full_name || user.email.split("@")[0];
        const { data: dbRecord, error } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .single();

        if (dbRecord) console.log(dbRecord.username);

        setUserData({
          googleName: googleName,
          dbName: dbRecord ? dbRecord.username : "",
          loading: false,
        });
      } else {
        setUserData({ googleName: "", dbName: "", loading: false });
      }
    };
    getUserData();
  }, []);
  return userData;
};