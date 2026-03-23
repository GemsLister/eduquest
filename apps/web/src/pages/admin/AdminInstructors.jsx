import { useState, useMemo } from "react";
import { useAdminInstructors } from "../../hooks/adminHook/useAdminInstructors.jsx";
import { InstructorTable } from "../../components/admin/InstructorTable.jsx";

export const AdminInstructors = () => {
  const { instructors, loading, error, statusLoading, toggleInstructorStatus } =
    useAdminInstructors();
  const [statusTarget, setStatusTarget] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | active | disabled

  const activeCount = useMemo(
    () => instructors.filter((i) => !i.is_disabled).length,
    [instructors],
  );
  const disabledCount = useMemo(
    () => instructors.filter((i) => i.is_disabled).length,
    [instructors],
  );

  const filtered = useMemo(() => {
    let list = instructors;

    if (statusFilter === "active") list = list.filter((i) => !i.is_disabled);
    if (statusFilter === "disabled") list = list.filter((i) => i.is_disabled);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          (i.first_name || "").toLowerCase().includes(q) ||
          (i.last_name || "").toLowerCase().includes(q) ||
          (i.username || "").toLowerCase().includes(q) ||
          (i.email || "").toLowerCase().includes(q),
      );
    }

    return list;
  }, [instructors, statusFilter, search]);

  const handleStatusClick = (instructor) => {
    setStatusTarget(instructor);
  };

  const handleConfirmStatus = async () => {
    if (!statusTarget) return;
    await toggleInstructorStatus(statusTarget.id, !statusTarget.is_disabled);
    setStatusTarget(null);
  };

  const filters = [
    { key: "all", label: "All", count: instructors.length },
    { key: "active", label: "Active", count: activeCount },
    { key: "disabled", label: "Disabled", count: disabledCount },
  ];

  return (
    <>
      {/* Page Header */}
      <div className="bg-gradient-to-r from-brand-navy to-brand-indigo px-6 py-8">
        <p className="text-brand-gold text-sm font-semibold uppercase tracking-widest mb-1">
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

        {/* Search + Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          {/* Search */}
          <div className="relative flex-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search by name, email, or username..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold focus:border-transparent"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Status Filter Tabs */}
          <div className="flex bg-gray-100 rounded-xl p-1">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  statusFilter === f.key
                    ? "bg-white text-gray-800 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {f.label}
                <span
                  className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                    statusFilter === f.key
                      ? "bg-brand-gold text-brand-navy"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {f.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-gold mx-auto mb-3"></div>
              <p className="text-gray-500 text-sm">Loading instructors...</p>
            </div>
          </div>
        ) : (
          <InstructorTable
            instructors={filtered}
            statusLoading={statusLoading}
            onToggleStatus={handleStatusClick}
          />
        )}

        {/* No results for search/filter */}
        {!loading && filtered.length === 0 && instructors.length > 0 && (
          <div className="text-center py-12">
            <div className="w-14 h-14 mx-auto mb-3 bg-gray-100 rounded-xl flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-7 w-7 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-600">
              No instructors found
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Try a different search term or filter.
            </p>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {statusTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
                statusTarget.is_disabled
                  ? "bg-green-100"
                  : "bg-amber-100"
              }`}
            >
              {statusTarget.is_disabled ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-green-600"
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
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-amber-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                  />
                </svg>
              )}
            </div>
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
                className={`flex-1 px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 ${
                  statusTarget.is_disabled
                    ? "bg-brand-gold hover:bg-brand-gold-dark text-brand-navy"
                    : "bg-amber-500 hover:bg-amber-600 text-white"
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
