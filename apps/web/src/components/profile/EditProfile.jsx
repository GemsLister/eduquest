import { useState } from "react";
import { PrimaryButton } from "../ui/PrimaryButton";

export const EditProfile = ({
  setProfile,
  profileFirstname,
  profileLastname,
  profileUsername,
  profileEmail,
  profileBio,
  updateProfile,
  saveLoading,
}) => {
  const [editMode, setEditMode] = useState(false);
  const handleSave = async () => {
    const success = await updateProfile();
    if (success) setEditMode(false);
  };
  return (
    <div>
      <PrimaryButton onClick={() => setEditMode(true)}>
        Edit Profile
      </PrimaryButton>
      {/* Edit Mode */}
      {editMode && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                label: "First Name",
                value: profileFirstname,
                type: "text",
                key: "firstName",
              },
              {
                label: "Last Name",
                value: profileLastname,
                type: "text",
                key: "lastName",
              },
              {
                label: "Username",
                value: profileUsername,
                type: "text",
                key: "username",
              },
              {
                label: "Email",
                value: profileEmail,
                type: "email",
                key: "email",
              },
            ].map((field, index) => (
              <div key={index}>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {field.label}
                </label>
                <input
                  type="text"
                  value={field.value}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      [field.key]: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-casual-green focus:ring-2 focus:ring-casual-green focus:ring-opacity-20"
                />
              </div>
            ))}
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Bio
            </label>
            <textarea
              value={profileBio || ""}
              onChange={(e) =>
                setProfile((prev) => ({
                  ...prev,
                  bio: e.target.value,
                }))
              }
              placeholder="Tell us about yourself"
              rows="4"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-casual-green focus:ring-2 focus:ring-casual-green focus:ring-opacity-20"
            />
          </div>

          {/* Buttons */}
          <div className="flex flex-col md:flex-row gap-4 pt-4">
            <PrimaryButton onClick={handleSave} disabled={saveLoading}>
              {saveLoading ? "Saving..." : "Save Changes"}
            </PrimaryButton>
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
          {profileBio && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Bio</h3>
              <p className="text-gray-600">{profileBio}</p>
            </div>
          )}
          {!profileBio && (
            <div className="text-gray-500 italic">No bio added yet</div>
          )}
        </div>
      )}
    </div>
  );
};
