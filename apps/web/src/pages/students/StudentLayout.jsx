import { Outlet } from "react-router-dom";
// Icons SVG
import {DashboardIcon} from "../../assets/svg/DashboardIcon.jsx";
import { QuizIcon } from "../../assets/svg/QuizIcon.jsx";
import { SummarizeIcon } from "../../assets/svg/SummarizeIcon.jsx";
import { ScoresIcon } from "../../assets/svg/ScoresIcon.jsx";
import { ProfileIcon } from "../../assets/svg/ProfileIcon.jsx";
import { LogoutIcon } from "../../assets/svg/LogoutIcon.jsx";
import { Sidebar } from "../../components/Sidebar.jsx";
import StudentImage from "../../assets/student-profile.png"
import { Header } from "../../components/Header.jsx";
export const StudentLayout = () => {
  // Student Sidebar navs
  const navs = [
    {
      name: "Home",
      path: "/student-dashboard",
      icon: <DashboardIcon />,
    },
    {
      name: "Quizzes",
      path: "/student-dashboard/student-quiz",
      icon: <QuizIcon />,
    },
    {
      name: "Summaries",
      path: "/student-dashboard/student-summaries",
      icon: <SummarizeIcon />,
    },
    {
      name: "Scores",
      path: "/student-dashboard/student-scores",
      icon: <ScoresIcon />,
    },
    {
      name: "Profile",
      path: "/student-dashboard/student-profile",
      icon: <ProfileIcon />,
    },
    {
      name: "Logout",
      path: "/",
      icon: <LogoutIcon />,
    },
  ];

  return (
    <div className="flex">
      <Sidebar navs={navs} />
      <div className="flex flex-col flex-1 h-screen bg-authentic-white">
        <Header profile={StudentImage} />
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
};