import { Sidebar } from "../../components/Sidebar.jsx";
import { Header } from "../../components/Header.jsx";
import { Outlet } from "react-router-dom";

export const Layout = () => {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-col flex-1 h-screen bg-authentic-white w-screen">
        <Header />
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
