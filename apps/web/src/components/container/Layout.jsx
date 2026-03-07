import { Sidebar } from "../Sidebar.jsx";
import { Outlet } from "react-router-dom";
import { Header } from "../Header.jsx";

export const Layout = () => {
  return (
    <div className="flex h-screen overflow-hidden bg-authentic-white">
      <Sidebar />
      <div className="flex flex-col flex-1 h-screen overflow-y-auto">
        <Header />
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
