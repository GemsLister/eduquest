import { Sidebar } from "../../components/Sidebar.jsx";
import { Header } from "../../components/Header.jsx";
import { DashboardIcon } from "../../assets/svg/DashboardIcon.jsx";
import { CreateQuizIcon } from "../../assets/svg/CreateQuizIcon.jsx";
import { QuestionIcon } from "../../assets/svg/QuestionIcon.jsx";
import { ProfileIcon } from "../../assets/svg/ProfileIcon.jsx";
import { LogoutIcon } from "../../assets/svg/LogoutIcon.jsx";
import { Outlet } from "react-router-dom";

export const InstructorLayout = () => {
  const navs = [
    {
      name: "Home",
      path: "/instructor-dashboard",
      icon: <DashboardIcon />,
    },
    {
      name: "Create Quiz",
      path: "/instructor-quiz",
      icon: <CreateQuizIcon />,
    },
    {
      name: "Questions",
      path: "/instructor-questions",
      icon: <QuestionIcon />,
    },
    {
      name: "Profile",
      path: "/instructor-profile",
      icon: <ProfileIcon />,
    },
    {
      name: "Logout",
      path: "/",
      icon: <LogoutIcon />,
    },
  ];

  return (
    <div className="flex h-screen">
      <Sidebar navs={navs} />
      <div className="flex flex-col flex-1 h-screen bg-authentic-white">
        <Header />
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
