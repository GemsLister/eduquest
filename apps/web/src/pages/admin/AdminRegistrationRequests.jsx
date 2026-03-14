import { useState } from "react";
import { useRegistrationRequests } from "../../hooks/adminHook/useRegistrationRequests.jsx";

export const AdminRegistrationRequests = () => {
  const {
    requests,
    loading,
    error,
    actionLoading,
    approveRequest,
    rejectRequest,
  } = useRegistrationRequests();

  const [confirmRejectId, setConfirmRejectId] = useState(null);

  const handleApprove = async (userId) => {
    await approveRequest(userId);
  };

  const handleReject = async () => {
    if (!confirmRejectId) return;
    await rejectRequest(confirmRejectId);
    setConfirmRejectId(null);
  };

  return (
    <>
      {/* Page Header */}
      <div className="bg-gradient-to-r from-slate-900 via-hornblende-green to-sea-green px-6 py-8">
        <p className="text-casual-green text-sm font-semibold uppercase tracking-widest mb-1">
          Admin
        </p>
        <h1 className="text-2xl md:text-3xl font-black text-white">
          Registration Requests
        </h1>
        <p className="text-white/60 text-sm mt-1">
          {requests.length} pending{" "}
          {requests.length === 1 ? "request" : "requests"}
        </p>
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-casual-green mx-auto mb-3"></div>
              <p className="text-gray-500 text-sm">Loading requests...</p>
            </div>
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-200">
            <div className="text-5xl mb-4">✅</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              No Pending Requests
            </h3>
            <p className="text-gray-400 text-sm">
              All registration requests have been reviewed.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-6 py-3 font-semibold text-gray-600">
                    Name
                  </th>
                  <th className="text-left px-6 py-3 font-semibold text-gray-600">
                    Email
                  </th>
                  <th className="text-left px-6 py-3 font-semibold text-gray-600">
                    Registered
                  </th>
                  <th className="text-right px-6 py-3 font-semibold text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {requests.map((req) => (
                  <tr
                    key={req.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-gray-800">
                      {req.username || "—"}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{req.email}</td>
                    <td className="px-6 py-4 text-gray-400">
                      {req.created_at
                        ? new Date(req.created_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleApprove(req.id)}
                          disabled={actionLoading === req.id}
                          className="px-4 py-1.5 bg-casual-green text-white rounded-lg font-semibold text-xs hover:bg-hornblende-green transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {actionLoading === req.id ? "..." : "Approve"}
                        </button>
                        <button
                          onClick={() => setConfirmRejectId(req.id)}
                          disabled={actionLoading === req.id}
                          className="px-4 py-1.5 bg-red-100 text-red-600 rounded-lg font-semibold text-xs hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject Confirmation Modal */}
      {confirmRejectId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              Reject Registration?
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              This will permanently delete the account and the user will not be
              able to log in. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmRejectId(null)}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading === confirmRejectId}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-lg font-semibold text-sm hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {actionLoading === confirmRejectId
                  ? "Rejecting..."
                  : "Yes, Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
