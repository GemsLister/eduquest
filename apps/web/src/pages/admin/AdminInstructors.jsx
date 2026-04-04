import { useState, useMemo, useEffect } from "react";
import { useAdminInstructors } from "../../hooks/adminHook/useAdminInstructors.jsx";
import { InstructorTable } from "../../components/admin/InstructorTable.jsx";
import { toast } from "react-toastify";

export const AdminInstructors = () => {
  const { instructors, loading, error, statusLoading, toggleInstructorStatus } =
    useAdminInstructors();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | active | disabled
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

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

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const handleStatusClick = async (instructor) => {
    const result = await toggleInstructorStatus(instructor.id, !instructor.is_disabled);
    if (result?.success) {
      toast.success(
        instructor.is_disabled
          ? `${instructor.first_name || instructor.email} has been activated.`
          : `${instructor.first_name || instructor.email} has been disabled.`
      );
    }
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
        ) : filtered.length > 0 ? (
          <InstructorTable
            instructors={paginated}
            statusLoading={statusLoading}
            onToggleStatus={handleStatusClick}
          />
        ) : null}

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

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <p className="text-xs text-gray-400">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–
              {Math.min(currentPage * PAGE_SIZE, filtered.length)} of{" "}
              {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 text-xs font-semibold rounded-lg transition-colors ${
                      page === currentPage
                        ? "bg-brand-gold text-brand-navy"
                        : "text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {page}
                  </button>
                ),
              )}
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

    </>
  );
};
