// "First Last", falling back to username, then email
export const getProfileName = (profile, fallback = "Unknown") => {
  if (!profile) return fallback;
  const name = `${profile.first_name || ""} ${profile.last_name || ""}`.trim();
  return name || profile.username || profile.email || fallback;
};

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-purple-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-teal-500",
];

// Stable avatar background for a user id, so a person keeps their color everywhere
export const getAvatarColor = (id) => {
  let hash = 0;
  for (let i = 0; i < (id || "").length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

export const getProfileInitials = (profile) => {
  if (!profile) return "?";
  if (profile.first_name || profile.last_name) {
    const initials = `${(profile.first_name || "")[0] || ""}${(profile.last_name || "")[0] || ""}`;
    return initials.toUpperCase() || "?";
  }
  return (profile.username || profile.email || "?")[0].toUpperCase();
};
