import { Sidebar } from "../Sidebar.jsx";
import { Outlet } from "react-router-dom";
import { Header } from "../Header.jsx";
import InstructorImage from "../../assets/instructor-profile.png";

export const Layout = () => {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 h-screen overflow-y-auto bg-authentic-white">
        <Header profile={InstructorImage} />
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
