import { Sidebar } from "../../components/Sidebar.jsx";
import { Header } from "../../components/Header.jsx";
import { Outlet } from "react-router-dom";
import InstructorImage from "../../assets/instructor-profile.png";

export const InstructorLayout = () => {
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
