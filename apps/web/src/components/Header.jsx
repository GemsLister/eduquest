import { useUsername } from "../hooks/useUsername";
import defaultAvatar from "../assets/instructor-profile.png";
import { Link } from "react-router-dom";

export const Header = () => {
  const userData = useUsername();
  if (userData.loading) return <h1>Loading...</h1>;

  return (
    <header className="flex items-end justify-end px-8 py-3">
      <Link
        to="/instructor-dashboard/instructor-profile"
        className="flex items-center gap-3 font-semibold hover:opacity-80 transition-opacity"
      >
        <img
          src={userData.avatarUrl || defaultAvatar}
          alt="instructor-image"
          className="h-10 w-10 rounded-full object-cover aspect-square"
        />
        <h2 className="text-[clamp(14px,4dvw,18px)]">
          {userData.googleName || userData.dbName}
        </h2>
      </Link>
    </header>
  );
};
