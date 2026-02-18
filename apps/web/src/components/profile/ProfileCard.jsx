import { EditProfile } from "./EditProfile";
export const ProfileCard = ({
  setProfile,
  profileImage,
  profileFirstname,
  profileLastname,
  profileUsername,
  profileEmail,
  profileBio,
  saveLoading,
  update,
}) => {
  return (
    <div className="flex justify-between w-full bg-white rounded-lg shadow-md p-4 md:p-8 mb-6">
      {/* Profile Header with Avatar */}
      <div className="flex flex-col md:items-start md:justify-between gap-4 md:gap-6 mb-8 pb-8 border-b-2 border-gray-200">
        {/* Profile Image */}
        <div className="flex flex-col md:flex-row md:items-start gap-4 md:gap-6 flex-1">
          <div className="flex-shrink-0 flex justify-center md:justify-start">
            <img
              src={profileImage}
              alt="profile"
              className="h-24 w-24 rounded-full border-4 border-casual-green"
            />
          </div>
          <div className="flex flex-col gap-1 text-center md:text-left flex-1">
            <p className="text-gray-600 text-sm mt-1">{profileFirstname}</p>
            <p className="text-gray-600 text-sm mt-1">{profileLastname}</p>
            <p className="text-gray-600 text-sm mt-1">@{profileUsername}</p>
            <p className="text-gray-600 text-sm mt-1 break-all">
              {profileEmail}
            </p>
            {/* Edit Button */}
            <EditProfile
              setProfile={setProfile}
              profileFirstname={profileFirstname}
              profileLastname={profileLastname}
              profileUsername={profileUsername}
              profileEmail={profileEmail}
              profileBio={profileBio}
              saveLoading={saveLoading}
              updateProfile={update}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
