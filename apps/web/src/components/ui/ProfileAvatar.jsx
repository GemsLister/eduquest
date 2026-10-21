import { useState } from "react";
import { getAvatarColor, getProfileInitials, getProfileName } from "../../utils/profileName.js";

/**
 * A person's profile picture (profiles.avatar_url), falling back to their
 * initials on their stable color when there's no picture or it fails to load.
 * `className` sets the size and text size, e.g. "w-11 h-11 text-sm".
 */
export const ProfileAvatar = ({ profile, id, className = "w-11 h-11 text-sm", muted = false }) => {
  const [failedUrl, setFailedUrl] = useState(null);
  const url = profile?.avatar_url;

  if (url && failedUrl !== url) {
    return (
      <img
        src={url}
        alt={`${getProfileName(profile, "User")}'s profile picture`}
        onError={() => setFailedUrl(url)}
        className={`rounded-full object-cover shrink-0 ${muted ? "grayscale opacity-60" : ""} ${className}`}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`rounded-full flex items-center justify-center text-white font-bold shrink-0 ${
        muted ? "bg-gray-400" : getAvatarColor(id || profile?.id)
      } ${className}`}
    >
      {getProfileInitials(profile)}
    </div>
  );
};
