import { useState, useEffect, useRef } from "react";
import { notify } from "../../utils/notify.jsx";
import { supabase } from "../../supabaseClient.js";
import { useAuth } from "../../context/AuthContext.jsx";
import profileImage from "../../assets/instructor-profile.png";
import citlCover from "../../assets/CITL_cover_photo.png";

export const InstructorProfile = () => {
  const { user: authUser } = useAuth();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({
    username: "",
    firstName: "",
    lastName: "",
    email: "",
    bio: "",
    avatarUrl: "",
    createdAt: "",
    isInstructor: false,
    isAdmin: false,
  });
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [stats, setStats] = useState({ quizzes: 0, published: 0, subjects: 0 });
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (authUser) fetchUserData();
  }, [authUser]);

  const fetchUserData = async () => {
    try {
      if (authUser) {
        setUser(authUser);

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", authUser.id)
          .single();

        if (profileError && profileError.code === "PGRST116") {
          // Profile doesn't exist yet — create it
          const email = authUser.email;
          const isStudentDomain = email.endsWith("@gmail.com");
          const firstName = authUser.user_metadata?.given_name || "";
          const lastName = authUser.user_metadata?.family_name || "";
          const username =
            authUser.user_metadata?.full_name || email.split("@")[0];

          const { data: newProfile, error: createError } = await supabase
            .from("profiles")
            .insert({
              id: authUser.id,
              username: username,
              first_name: firstName,
              last_name: lastName,
              bio: "",
              is_instructor: !isStudentDomain,
              is_approved: true, // Auto-approve everyone for testing
              email: email,
            })
            .select()
            .single();

          if (createError) throw createError;

          const hasInstructorAccess =
            !!newProfile.is_instructor ||
            newProfile.role === "teacher" ||
            !!newProfile.is_admin ||
            !!newProfile.is_faculty_head;

          if (!hasInstructorAccess) {
            notify.error(
              "Access Denied: You are signed in with a student account. Please log out to access instructor features.",
            );
            setLoading(false);
            return;
          }

          setProfile({
            username: newProfile.username || "",
            firstName: newProfile.first_name || "",
            lastName: newProfile.last_name || "",
            email: email,
            bio: newProfile.bio || "",
            avatarUrl: newProfile.avatar_url || "",
            createdAt: newProfile.created_at || authUser.created_at || "",
            isInstructor: newProfile.is_instructor,
            isAdmin: newProfile.is_admin,
          });
        } else if (profileError) {
          throw profileError;
        } else {
          const hasInstructorAccess =
            !!profileData.is_instructor ||
            profileData.role === "teacher" ||
            !!profileData.is_admin ||
            !!profileData.is_faculty_head;

          if (!hasInstructorAccess) {
            notify.error(
              "Access Denied: You are signed in with a student account. Please log out to access instructor features.",
            );
            setLoading(false);
            return;
          }

          setProfile({
            username: profileData.username || "",
            firstName: profileData.first_name || "",
            lastName: profileData.last_name || "",
            email: authUser.email,
            bio: profileData.bio || "",
            avatarUrl: profileData.avatar_url || "",
            createdAt: profileData.created_at || authUser.created_at || "",
            isInstructor: profileData.is_instructor,
            isAdmin: profileData.is_admin,
          });
        }

        // Load activity stats
        const [quizzesRes, sectionsRes] = await Promise.all([
          supabase
            .from("quizzes")
            .select("id, is_published")
            .eq("instructor_id", authUser.id)
            .eq("is_archived", false),
          supabase
            .from("sections")
            .select("id", { count: "exact", head: true })
            .eq("instructor_id", authUser.id)
            .eq("is_archived", false),
        ]);

        const quizzes = quizzesRes.data || [];
        setStats({
          quizzes: quizzes.length,
          published: quizzes.filter((q) => q.is_published).length,
          subjects: sectionsRes.count || 0,
        });
      } else {
        throw new Error("Auth session missing!");
      }
    } catch (err) {
      notify.error(`Failed to load profile: ${err.message || "Unknown error"}`);
      console.error("Profile load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      notify.error(
        "Please upload a valid image file (JPEG, PNG, GIF, or WebP)",
      );
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      notify.error("Image must be less than 2MB");
      return;
    }

    setAvatarUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      const avatarUrl = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
        .eq("id", user.id);

      if (updateError) throw updateError;

      setProfile((prev) => ({ ...prev, avatarUrl }));
      notify.success("Profile picture updated!");
    } catch (err) {
      notify.error(err.message || "Failed to upload avatar");
      console.error(err);
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleUpdateProfile = async () => {
    setSaveLoading(true);

    try {
      if (!profile.username.trim() || !profile.firstName.trim()) {
        notify.error("Username and First Name are required");
        setSaveLoading(false);
        return;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          username: profile.username,
          first_name: profile.firstName,
          last_name: profile.lastName,
          bio: profile.bio,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (updateError) throw updateError;

      notify.success("Profile updated successfully!");
      setEditMode(false);
    } catch (err) {
      notify.error(err.message || "Failed to update profile");
      console.error(err);
    } finally {
      setSaveLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)] bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand-gold"></div>
          <p className="mt-4 text-brand-navy font-semibold">
            Loading profile...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      {/* Banner */}
      <div className="relative h-52 bg-brand-navy overflow-hidden">
        <img
          src={citlCover}
          alt="CITL Cover"
          className="absolute inset-0 w-full h-full object-cover object-[center_55%] opacity-30"
        />
        {/* Edit button in banner */}
        {!editMode && (
          <button
            onClick={() => setEditMode(true)}
            className="absolute top-4 right-6 flex items-center gap-1.5 px-4 py-2 bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white rounded-lg text-sm font-semibold transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
            Edit Profile
          </button>
        )}
      </div>

      <div className="px-6 -mt-16 pb-8 max-w-4xl mx-auto">
        {/* Profile Card — overlaps banner */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 mb-6">
          <div className="px-6 pt-0 pb-5">
            {/* Avatar overlapping banner */}
            <div className="relative -mt-14 mb-4 w-fit">
              <img
                src={profile.avatarUrl || profileImage}
                alt="profile"
                className="h-28 w-28 rounded-2xl border-4 border-white shadow-lg object-cover"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="absolute -bottom-1 -right-1 bg-brand-gold hover:bg-brand-gold-dark text-white rounded-lg p-1.5 shadow-md transition-colors"
                title="Change profile picture"
              >
                {avatarUploading ? (
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                )}
              </button>
            </div>

            {/* Name + Meta */}
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-black text-gray-900">
                  {profile.firstName || profile.lastName
                    ? `${profile.firstName} ${profile.lastName}`.trim()
                    : profile.username || "No Name"}
                </h1>
                <span className="px-2.5 py-0.5 bg-brand-gold/10 text-brand-gold-dark text-xs font-bold rounded-full">
                  Instructor
                </span>
              </div>
              <p className="text-gray-500 text-sm mt-1">@{profile.username}</p>
              <p className="text-gray-400 text-xs mt-0.5">{profile.email}</p>
            </div>
          </div>

          {/* Bio Section */}
          {!editMode && (
            <div className="px-6 pb-6">
              {profile.bio ? (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <div className="flex items-start gap-3">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 text-gray-300 shrink-0 mt-0.5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                    </svg>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {profile.bio}
                    </p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setEditMode(true)}
                  className="w-full bg-gray-50 hover:bg-gray-100 border border-dashed border-gray-300 rounded-xl p-4 text-center transition-colors group"
                >
                  <p className="text-sm text-gray-400 group-hover:text-gray-500">
                    <span className="font-semibold">Add a bio</span> — Tell
                    others about yourself, your teaching focus, or interests.
                  </p>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Edit Mode */}
        {editMode && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-bold text-gray-800 mb-5">
              Edit Profile
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={profile.firstName}
                    onChange={(e) =>
                      setProfile({ ...profile, firstName: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold focus:ring-opacity-20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={profile.lastName}
                    onChange={(e) =>
                      setProfile({ ...profile, lastName: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold focus:ring-opacity-20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  value={profile.username}
                  onChange={(e) =>
                    setProfile({ ...profile, username: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold focus:ring-opacity-20"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Email (Read-only)
                </label>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 text-sm cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Bio
                </label>
                <textarea
                  value={profile.bio}
                  onChange={(e) =>
                    setProfile({ ...profile, bio: e.target.value })
                  }
                  placeholder="Tell others about yourself, your teaching focus, or interests..."
                  rows="3"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold focus:ring-opacity-20 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setEditMode(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateProfile}
                  disabled={saveLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-gold text-brand-navy rounded-lg font-semibold text-sm hover:bg-brand-gold-dark transition-colors disabled:opacity-50"
                >
                  {saveLoading ? (
                    <>
                      <svg
                        className="animate-spin h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Activity Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 text-center">
            <div className="w-10 h-10 mx-auto mb-2 bg-indigo-100 rounded-xl flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-indigo-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            <p className="text-2xl font-black text-gray-800">{stats.quizzes}</p>
            <p className="text-xs text-gray-400 font-medium mt-0.5">
              Quizzes Created
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 text-center">
            <div className="w-10 h-10 mx-auto mb-2 bg-green-100 rounded-xl flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-2xl font-black text-gray-800">
              {stats.published}
            </p>
            <p className="text-xs text-gray-400 font-medium mt-0.5">
              Published
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 text-center">
            <div className="w-10 h-10 mx-auto mb-2 bg-amber-100 rounded-xl flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-amber-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <p className="text-2xl font-black text-gray-800">
              {stats.subjects}
            </p>
            <p className="text-xs text-gray-400 font-medium mt-0.5">Subjects</p>
          </div>
        </div>

        {/* Account Information — 2-column grid with icons */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">
            Account Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Email
                </p>
                <p className="text-sm font-semibold text-gray-700 truncate">
                  {profile.email}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Role
                </p>
                <p className="text-sm font-semibold text-gray-700">
                  Instructor
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-emerald-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728M12 12h.01"
                  />
                </svg>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Status
                </p>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <p className="text-sm font-semibold text-green-600">Active</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-purple-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Member Since
                </p>
                <p className="text-sm font-semibold text-gray-700">
                  {formatDate(profile.createdAt)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
