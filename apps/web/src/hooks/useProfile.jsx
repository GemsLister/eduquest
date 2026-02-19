import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";
export const useProfile = () => {
  const [user, setUser] = useState();
  const [profile, setProfile] = useState({
    username: "",
    firstName: "",
    lastName: "",
    email: "",
    bio: "",
  });
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchUser = useCallback(async () => {
    try {
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (authUser) {
        setUser(authUser);

        // Set default profile data
        const firstName = authUser.user_metadata?.given_name || "";
        const lastName = authUser.user_metadata?.family_name || "";
        const username =
          authUser.user_metadata?.full_name || authUser.email.split("@")[0];

        setProfile({
          username: username,
          firstName: firstName,
          lastName: lastName,
          email: authUser.email,
          bio: "",
        });
      }
    } catch (err) {
      setError("Failed to load profile");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProfile = async () => {
    setSaveLoading(true);
    setError("");
    setSuccess("");

    try {
      if (!profile.username.trim() || !profile.firstName.trim()) {
        throw new Error("Username and First Name are required");
        // setSaveLoading(false);
        // return;
      }
      setSuccess("Profile updated successfully!");
    } catch (err) {
      setError(err.message || "Failed to update profile");
      console.error(err);
    } finally {
      setSaveLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);
  return {
    profile,
    setProfile,
    loading,
    saveLoading,
    error,
    success,
    updateProfile,
  };
};
