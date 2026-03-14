import { Outlet } from "react-router-dom";
import { Sidebar } from "../../components/Sidebar.jsx";

export function InstructorLayout() {
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
