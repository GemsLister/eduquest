import { useUsername } from "../hooks/useUsername";

export const Header = ({profile}) => {
  const userData = useUsername();
  if (userData.loading) return <h1>Loading...</h1>;

  return (
    <header className="flex items-end justify-end px-8 py-3">
      {/* Instructor name */}
      <div className="flex items-center gap-3 font-semibold">
        <img
          src={profile}
          alt="instructor-image"
          className="h-[clamp(30px,13dvw,40px)] w-[clamp(30px,13dvw,45px)] rounded-full"
        />
        <h2 className="text-[clamp(14px,4dvw,18px)]">
          {userData.googleName || userData.dbName}
        </h2>
      </div>
    </header>
  );
};
