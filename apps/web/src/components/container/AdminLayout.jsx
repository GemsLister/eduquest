import { AdminSidebar } from "../admin/AdminSidebar.jsx";
import { Outlet } from "react-router-dom";
import { Header } from "../Header.jsx";

export const AdminLayout = () => {
  return (
    <div className="flex h-screen overflow-hidden bg-authentic-white">
      <AdminSidebar />
      <div className="flex flex-col flex-1 h-screen overflow-y-auto">
        <Header />
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
