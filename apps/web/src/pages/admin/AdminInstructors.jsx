import { useState } from "react";
import { useAdminInstructors } from "../../hooks/adminHook/useAdminInstructors.jsx";
import { InstructorTable } from "../../components/admin/InstructorTable.jsx";

export const AdminInstructors = () => {
  const { instructors, loading, error, statusLoading, toggleInstructorStatus } =
    useAdminInstructors();
  const [statusTarget, setStatusTarget] = useState(null);

  const handleStatusClick = (instructor) => {
    setStatusTarget(instructor);
  };

  const handleConfirmStatus = async () => {
    if (!statusTarget) return;
    await toggleInstructorStatus(statusTarget.id, !statusTarget.is_disabled);
    setStatusTarget(null);
  };

  return (
    <>
      {/* Page Header */}
      <div className="bg-gradient-to-r from-slate-900 via-hornblende-green to-sea-green px-6 py-8">
        <p className="text-casual-green text-sm font-semibold uppercase tracking-widest mb-1">
          Admin
        </p>
        <h1 className="text-2xl md:text-3xl font-black text-white">
          Instructor Accounts
        </h1>
        <p className="text-white/60 text-sm mt-1">
          {instructors.length}{" "}
          {instructors.length === 1 ? "instructor" : "instructors"} registered
        </p>
      </div>

      <div className="p-6">
        {/* Error banner */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-casual-green mx-auto mb-3"></div>
              <p className="text-gray-500 text-sm">Loading instructors...</p>
            </div>
          </div>
        ) : (
          <InstructorTable
            instructors={instructors}
            statusLoading={statusLoading}
            onToggleStatus={handleStatusClick}
          />
        )}
      </div>

      {statusTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              {statusTarget.is_disabled
                ? "Enable Instructor?"
                : "Disable Instructor?"}
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              {statusTarget.is_disabled
                ? "This will restore the instructor's access. Their quizzes, sections, and records will remain unchanged."
                : "This will block the instructor from logging in, but their quizzes, sections, and records will stay in the database."}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setStatusTarget(null)}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmStatus}
                disabled={statusLoading === statusTarget.id}
                className={`flex-1 px-4 py-2.5 text-white rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 ${
                  statusTarget.is_disabled
                    ? "bg-casual-green hover:bg-hornblende-green"
                    : "bg-amber-500 hover:bg-amber-600"
                }`}
              >
                {statusLoading === statusTarget.id
                  ? statusTarget.is_disabled
                    ? "Enabling..."
                    : "Disabling..."
                  : statusTarget.is_disabled
                    ? "Yes, Enable"
                    : "Yes, Disable"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
