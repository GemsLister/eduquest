import { useState } from "react";
import { useRegistrationRequests } from "../../hooks/adminHook/useRegistrationRequests.jsx";
import { toast } from "react-toastify";

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
  const [bulkLoading, setBulkLoading] = useState(false);

  const handleApprove = async (userId) => {
    await approveRequest(userId);
  };

  const handleReject = async () => {
    if (!confirmRejectId) return;
    await rejectRequest(confirmRejectId);
    setConfirmRejectId(null);
  };

  const handleApproveAll = async () => {
    if (requests.length === 0) return;
    setBulkLoading(true);
    let successCount = 0;
    for (const req of requests) {
      const result = await approveRequest(req.id);
      if (!result?.error) successCount++;
    }
    setBulkLoading(false);
    if (successCount > 0) {
      toast.success(`${successCount} instructor(s) approved successfully`);
    }
  };

  const timeAgo = (dateStr) => {
    if (!dateStr) return "—";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getInitials = (req) => {
    if (req.username) return req.username.slice(0, 2).toUpperCase();
    if (req.email) return req.email[0].toUpperCase();
    return "?";
  };

  const rejectTarget = requests.find((r) => r.id === confirmRejectId);

  return (
    <>
      {/* Page Header */}
      <div className="bg-gradient-to-r from-slate-900 via-hornblende-green to-sea-green px-6 py-8">
        <p className="text-casual-green text-sm font-semibold uppercase tracking-widest mb-1">
          Admin
        </p>
        <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
          Registration Requests
          {requests.length > 0 && (
            <span className="flex items-center gap-2 px-3 py-1 bg-yellow-400/20 rounded-full">
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              <span className="text-sm font-bold text-yellow-300">
                {requests.length}
              </span>
            </span>
          )}
        </h1>
        <p className="text-white/60 text-sm mt-1">
          {requests.length === 0
            ? "All caught up — no pending requests"
            : `${requests.length} pending ${requests.length === 1 ? "request" : "requests"} awaiting review`}
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
          /* Empty State */
          <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-200">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-2xl flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-700 mb-2">
              No Pending Requests
            </h3>
            <p className="text-gray-400 text-sm max-w-sm mx-auto">
              All registration requests have been reviewed. New requests will
              appear here when instructors register for an account.
            </p>
          </div>
        ) : (
          <>
            {/* Approve All Bar */}
            {requests.length > 1 && (
              <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-3.5 mb-5">
                <div className="flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-indigo-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-sm text-indigo-700">
                    <span className="font-semibold">{requests.length} requests</span>{" "}
                    are waiting for your review.
                  </p>
                </div>
                <button
                  onClick={handleApproveAll}
                  disabled={bulkLoading}
                  className="px-4 py-2 bg-casual-green hover:bg-hornblende-green text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {bulkLoading ? (
                    <>
                      <svg
                        className="animate-spin h-3.5 w-3.5"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Approving...
                    </>
                  ) : (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Approve All
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Request Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {requests.map((req) => {
                const isActioning = actionLoading === req.id;
                return (
                  <div
                    key={req.id}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-all"
                  >
                    {/* Top: Avatar + Info */}
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-11 h-11 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {getInitials(req)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-gray-800 text-sm truncate">
                          {req.username || "No username"}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-3.5 w-3.5 text-gray-400 shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                            />
                          </svg>
                          <span className="text-xs text-gray-500 truncate">
                            {req.email}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Registered time */}
                    <div className="flex items-center gap-1.5 mb-4 text-xs text-gray-400">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3.5 w-3.5 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span>Registered {timeAgo(req.created_at)}</span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(req.id)}
                        disabled={isActioning}
                        className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-casual-green text-white rounded-lg font-semibold text-xs hover:bg-hornblende-green transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isActioning ? (
                          <>
                            <svg
                              className="animate-spin h-3.5 w-3.5"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              />
                            </svg>
                            Approving...
                          </>
                        ) : (
                          <>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-3.5 w-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2.5}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            Approve
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => setConfirmRejectId(req.id)}
                        disabled={isActioning}
                        className="px-4 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-lg font-semibold text-xs hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Reject Confirmation Modal */}
      {confirmRejectId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              Reject Registration?
            </h3>
            <p className="text-sm text-gray-500 mb-1">
              This will permanently delete the account for{" "}
              <span className="font-semibold text-gray-700">
                {rejectTarget?.username || rejectTarget?.email || "this user"}
              </span>
              .
            </p>
            <p className="text-xs text-red-500 mb-6">
              This action cannot be undone. The user will not be able to log in.
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
