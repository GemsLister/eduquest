import { useState, useEffect } from "react";
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

  const [bulkLoading, setBulkLoading] = useState(false);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const handleApprove = async (userId) => {
    await approveRequest(userId);
  };

  const handleReject = async (userId) => {
    await rejectRequest(userId);
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

  return (
    <>
      {/* Page Header */}
      <div className="bg-gradient-to-r from-brand-navy to-brand-indigo px-6 py-8">
        <p className="text-brand-gold text-sm font-semibold uppercase tracking-widest mb-1">
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
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-gold mx-auto mb-3"></div>
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
              <div className="flex items-center justify-between bg-brand-gold/10 border border-brand-gold/20 rounded-xl px-5 py-3.5 mb-5">
                <div className="flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-brand-gold-dark"
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
                  <p className="text-sm text-brand-navy">
                    <span className="font-semibold">{requests.length} requests</span>{" "}
                    are waiting for your review.
                  </p>
                </div>
                <button
                  onClick={handleApproveAll}
                  disabled={bulkLoading}
                  className="px-4 py-2 bg-brand-gold hover:bg-brand-gold-dark text-brand-navy text-xs font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
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
                      <div className="w-11 h-11 rounded-full bg-brand-navy flex items-center justify-center text-white font-bold text-sm shrink-0">
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
                        className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-brand-gold text-brand-navy rounded-lg font-semibold text-xs hover:bg-brand-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                        onClick={() => handleReject(req.id)}
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

    </>
  );
};
