import { Sidebar } from "../../components/Sidebar.jsx";
import { Header } from "../../components/Header.jsx";
// import { DashboardIcon } from "../../assets/svg/DashboardIcon.jsx";
// import { QuizIcon } from "../../assets/svg/QuizIcon.jsx";
// import { QuestionIcon } from "../../assets/svg/sidebar/QuestionIcon.jsx";
// import { ProfileIcon } from "../../assets/svg/ProfileIcon.jsx";
// import { LogoutIcon } from "../../assets/svg/LogoutIcon.jsx";
import { Outlet } from "react-router-dom";
import InstructorImage from "../../assets/instructor-profile.png";
import * as SidebarIcon from "../../assets/svg/sidebar/sidebarIcons.js"

export const InstructorLayout = () => {
  const navs = [
    {
      name: "Home",
      path: "/instructor-dashboard",
      icon: <SidebarIcon.DashboardIcon />,
    },
    {
      name: "Questions",
      path: "/instructor-dashboard/instructor-questions",
      icon: <SidebarIcon.QuestionIcon />,
    },
    {
      name: "Profile",
      path: "/instructor-dashboard/instructor-profile",
      icon: <SidebarIcon.ProfileIcon />,
    },
    {
      name: "Logout",
      path: "/",
      icon: <SidebarIcon.LogoutIcon />,
    },
  ];

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