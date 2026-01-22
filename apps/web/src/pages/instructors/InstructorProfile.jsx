import { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient.js";
import profileImage from "../../assets/instructor-profile.png";

export const InstructorProfile = () => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({
    username: "",
    firstName: "",
    lastName: "",
    email: "",
    bio: "",
  });
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (authUser) {
        setUser(authUser);

        // TODO: Fetch profile from database
        // const { data: profileData, error: profileError } = await supabase
        //   .from("profiles")
        //   .select("*")
        //   .eq("id", authUser.id)
        //   .single();

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
  };

  const handleUpdateProfile = async () => {
    setSaveLoading(true);
    setError("");
    setSuccess("");

    try {
      if (!profile.username.trim() || !profile.firstName.trim()) {
        setError("Username and First Name are required");
        setSaveLoading(false);
        return;
      }

      // TODO: Update profile in database
      // const { error: updateError } = await supabase
      //   .from("profiles")
      //   .update({
      //     username: profile.username,
      //     first_name: profile.firstName,
      //     last_name: profile.lastName,
      //     bio: profile.bio,
      //   })
      //   .eq("id", user.id);

      // if (updateError) throw updateError;

      setSuccess("Profile updated successfully!");
      setEditMode(false);
    } catch (err) {
      setError(err.message || "Failed to update profile");
      console.error(err);
    } finally {
      setSaveLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-casual-green"></div>
          <p className="mt-4 text-hornblende-green font-semibold">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-authentic-white p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-hornblende-green mb-2">
          My Profile
        </h1>
        <p className="text-gray-600">Manage your account information</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
          {success}
        </div>
      )}

      {/* Profile Card */}
      <div className="bg-white rounded-lg shadow-md p-8 mb-6">
        {/* Profile Header with Avatar */}
        <div className="flex items-start justify-between mb-8 pb-8 border-b-2 border-gray-200">
          <div className="flex items-start gap-6">
            <div className="flex-shrink-0">
              <img
                src={profileImage}
                alt="profile"
                className="h-24 w-24 rounded-full border-4 border-casual-green"
              />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-hornblende-green">
                {profile.firstName} {profile.lastName}
              </h2>
              <p className="text-gray-600 text-sm mt-1">@{profile.username}</p>
              <p className="text-gray-600 text-sm mt-1">{profile.email}</p>
            </div>
          </div>

          {!editMode && (
            <button
              onClick={() => setEditMode(true)}
              className="bg-casual-green text-white px-6 py-2 rounded-lg font-semibold hover:bg-hornblende-green transition-colors"
            >
              Edit Profile
            </button>
          )}
        </div>

        {/* Edit Mode */}
        {editMode && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* First Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  First Name
                </label>
                <input
                  type="text"
                  value={profile.firstName}
                  onChange={(e) =>
                    setProfile({ ...profile, firstName: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-casual-green focus:ring-2 focus:ring-casual-green focus:ring-opacity-20"
                />
              </div>

              {/* Last Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Last Name
                </label>
                <input
                  type="text"
                  value={profile.lastName}
                  onChange={(e) =>
                    setProfile({ ...profile, lastName: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-casual-green focus:ring-2 focus:ring-casual-green focus:ring-opacity-20"
                />
              </div>
            </div>

            {/* Username */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Username *
              </label>
              <input
                type="text"
                value={profile.username}
                onChange={(e) =>
                  setProfile({ ...profile, username: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-casual-green focus:ring-2 focus:ring-casual-green focus:ring-opacity-20"
              />
            </div>

            {/* Email (Read-only) */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email (Read-only)
              </label>
              <input
                type="email"
                value={profile.email}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
              />
            </div>

            {/* Bio */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Bio
              </label>
              <textarea
                value={profile.bio}
                onChange={(e) =>
                  setProfile({ ...profile, bio: e.target.value })
                }
                placeholder="Tell us about yourself"
                rows="4"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-casual-green focus:ring-2 focus:ring-casual-green focus:ring-opacity-20"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-4 pt-4">
              <button
                onClick={handleUpdateProfile}
                disabled={saveLoading}
                className="flex-1 bg-casual-green text-white px-6 py-3 rounded-lg font-semibold hover:bg-hornblende-green transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saveLoading ? "Saving..." : "Save Changes"}
              </button>
              <button
                onClick={() => setEditMode(false)}
                className="flex-1 bg-gray-300 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* View Mode */}
        {!editMode && (
          <div className="space-y-4">
            {profile.bio && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Bio
                </h3>
                <p className="text-gray-600">{profile.bio}</p>
              </div>
            )}
            {!profile.bio && (
              <div className="text-gray-500 italic">No bio added yet</div>
            )}
          </div>
        )}
      </div>

      {/* Account Info */}
      <div className="bg-white rounded-lg shadow-md p-8 mb-6">
        <h3 className="text-xl font-bold text-hornblende-green mb-6">
          Account Information
        </h3>

        <div className="space-y-4">
          <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-semibold text-gray-700">Email</p>
              <p className="text-gray-600">{profile.email}</p>
            </div>
          </div>

          <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-semibold text-gray-700">Role</p>
              <p className="text-gray-600">Instructor</p>
            </div>
          </div>

          <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-semibold text-gray-700">
                Account Status
              </p>
              <p className="text-green-600 font-semibold">Active</p>
            </div>
          </div>
        </div>
      </div>

      {/* Security Settings */}
      <div className="bg-white rounded-lg shadow-md p-8">
        <h3 className="text-xl font-bold text-hornblende-green mb-6">
          Security
        </h3>

        <div className="space-y-4">
          <p className="text-gray-600 mb-4">
            For your account security, you can change your password or manage
            your account settings.
          </p>

          <button className="w-full bg-gray-100 text-gray-800 border-2 border-gray-300 px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors">
            Change Password
          </button>
        </div>
      </div>
    </div>
  );
};
