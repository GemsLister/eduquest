import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
export const useProfile = () => {
  const { user } = useAuth();
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

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const firstName = user.user_metadata?.given_name || "";
    const lastName = user.user_metadata?.family_name || "";
    const username =
      user.user_metadata?.full_name || user.email.split("@")[0];

    setProfile({
      username: username,
      firstName: firstName,
      lastName: lastName,
      email: user.email,
      bio: "",
    });
    setLoading(false);
  }, [user]);

  const updateProfile = async () => {
    setSaveLoading(true);
    setError("");
    setSuccess("");

    try {
      if (!profile.username.trim() || !profile.firstName.trim()) {
        throw new Error("Username and First Name are required");
      }
      setSuccess("Profile updated successfully!");
    } catch (err) {
      setError(err.message || "Failed to update profile");
      console.error(err);
    } finally {
      setSaveLoading(false);
    }
  };

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
