import { FacultyHeadSidebar } from "../faculty-head/FacultyHeadSidebar.jsx";
import { Outlet } from "react-router-dom";

export const FacultyHeadLayout = () => {
  return (
    <div className="flex h-screen overflow-hidden bg-authentic-white">
      <FacultyHeadSidebar />
      <div className="flex flex-col flex-1 h-screen overflow-y-auto">
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
