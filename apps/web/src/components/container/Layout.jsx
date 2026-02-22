import { Sidebar } from "../Sidebar.jsx";
import { Outlet } from "react-router-dom";
import { Header } from "../Header.jsx";
import InstructorImage from "../../assets/instructor-profile.png";

export const Layout = ({ children }) => {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-col flex-1 h-screen bg-authentic-white">
        <Header profile={InstructorImage} />
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
