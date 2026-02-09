import { useUsername } from "../hooks/useUsername";

export const Header = ({ profile }) => {
  const userData = useUsername();
  if (userData.loading) return <h1 className="text-center py-4">Loading...</h1>;

  return (
    <header className="flex items-end justify-end px-4 md:px-6 lg:px-8 py-3 md:py-4 bg-white border-b border-gray-200">
      {/* Instructor name */}
      <div className="flex items-center gap-2 md:gap-3 font-semibold">
        <img
          src={profile}
          alt="instructor-image"
          className="h-8 md:h-10 w-8 md:w-10 rounded-full border-2 border-casual-green"
        />
        <h2 className="text-sm md:text-base lg:text-lg text-gray-800 truncate">
          {userData.googleName || userData.dbName}
        </h2>
      </div>
    </header>
  );
};
