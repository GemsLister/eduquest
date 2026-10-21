/**
 * "Jane Cruz (Senior Faculty)" / "John Reyes (Peer Reviewer)" for a reviewer
 * profile, so feedback is attributed to a person instead of a generic
 * "Reviewer".
 */
export const getReviewerRole = (profile) =>
  profile?.is_admin ? "Senior Faculty" : "Peer Reviewer";

export const formatReviewerLabel = (profile, fallback = "Reviewer") => {
  if (!profile) return fallback;
  const name =
    `${profile.first_name || ""} ${profile.last_name || ""}`.trim() ||
    profile.username ||
    profile.email ||
    fallback;
  return `${name} (${getReviewerRole(profile)})`;
};
