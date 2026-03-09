import { useState } from "react";
import { useAdminInstructors } from "../../hooks/adminHook/useAdminInstructors.jsx";
import { InstructorTable } from "../../components/admin/InstructorTable.jsx";

export const AdminInstructors = () => {
  const { instructors, loading, error, deleteLoading, deleteInstructor } =
    useAdminInstructors();
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const handleDeleteClick = (id) => {
    setConfirmDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;
    await deleteInstructor(confirmDeleteId);
    setConfirmDeleteId(null);
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
            deleteLoading={deleteLoading}
            onDelete={handleDeleteClick}
          />
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              Delete Instructor?
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              This will permanently remove the instructor&apos;s account and all
              associated data. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteLoading === confirmDeleteId}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-semibold text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteLoading === confirmDeleteId
                  ? "Deleting..."
                  : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
