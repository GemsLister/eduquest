import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient.js";
import { useAdminInstructors } from "../../hooks/adminHook/useAdminInstructors.jsx";

export const AdminDashboard = () => {
  const { instructors, loading } = useAdminInstructors();
  const [adminName, setAdminName] = useState("");

  useEffect(() => {
    const getAdmin = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const name =
          user.user_metadata?.full_name || user.email?.split("@")[0] || "Admin";
        setAdminName(name);
      }
    };
    getAdmin();
  }, []);

  return (
    <>
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-hornblende-green to-sea-green px-6 py-8">
        <p className="text-casual-green text-sm font-semibold uppercase tracking-widest mb-1">
          Admin
        </p>
        <h1 className="text-2xl md:text-3xl font-black text-white">
          Welcome back, {adminName}
        </h1>
        <p className="text-white/60 text-sm mt-1">
          Manage instructor accounts and system settings here.
        </p>
      </div>

      {/* Stats */}
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex items-center gap-4">
            <div className="text-3xl">👥</div>
            <div>
              <p className="text-sm text-gray-500 font-medium">
                Total Instructors
              </p>
              <p className="text-3xl font-black text-hornblende-green">
                {loading ? "—" : instructors.length}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex items-center gap-4">
            <div className="text-3xl">📅</div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Today</p>
              <p className="text-base font-bold text-gray-700">
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Quick links */}
        <div className="mt-6">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3">
            Quick Actions
          </h2>
          <div className="flex flex-wrap gap-3">
            <a
              href="/admin-dashboard/create-instructor"
              className="px-5 py-2.5 bg-casual-green text-white rounded-lg font-semibold text-sm hover:bg-hornblende-green transition-colors"
            >
              + Create Instructor
            </a>
            <a
              href="/admin-dashboard/instructors"
              className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-50 transition-colors"
            >
              View All Instructors
            </a>
          </div>
        </div>
      </div>
    </>
  );
};
