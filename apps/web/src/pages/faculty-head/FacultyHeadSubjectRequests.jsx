import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { notify } from "../../utils/notify.jsx";
import { subjectService } from "../../services/subjectService.js";

export const FacultyHeadSubjectRequests = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [allRequests, setAllRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all, pending, approved, rejected
  const [search, setSearch] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [rejectModalTarget, setRejectModalTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 8;

  // Direct subject creation form
  const [newSubject, setNewSubject] = useState({
    subject_name: "",
    subject_code: "",
    grade_level: "1st",
    description: "",
  });
  const [creatingSubject, setCreatingSubject] = useState(false);

  const gradeLevels = ["1st", "2nd", "3rd", "4th"];

  useEffect(() => {
    fetchRequests();
    window.addEventListener("subject-requests-changed", fetchRequests);
    window.addEventListener("pending-subject-requests-changed", fetchRequests);
    return () => {
      window.removeEventListener("subject-requests-changed", fetchRequests);
      window.removeEventListener("pending-subject-requests-changed", fetchRequests);
    };
  }, [user]);

  // Reset pagination on filter or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, search]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const { data, error } = await subjectService.getAllSubjectRequests();
      if (error) throw error;
      setAllRequests(data || []);
    } catch (err) {
      console.error("Error fetching subject requests:", err);
      setAllRequests([]);
    } finally {
      setLoading(false);
    }
  };

  // Top level stats computed across all requests regardless of active filter
  const pendingCount = useMemo(
    () => allRequests.filter((r) => r.request_status === "pending").length,
    [allRequests]
  );
  const approvedToday = useMemo(
    () =>
      allRequests.filter(
        (r) =>
          r.request_status === "approved" &&
          new Date(r.reviewed_at || r.created_at).toDateString() ===
            new Date().toDateString()
      ).length,
    [allRequests]
  );
  const totalProcessed = useMemo(
    () => allRequests.filter((r) => r.request_status !== "pending").length,
    [allRequests]
  );

  // Filtered requests based on active tab and search term
  const filteredRequests = useMemo(() => {
    let list = allRequests;
    if (filter !== "all") {
      list = list.filter((r) => r.request_status === filter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.subject_name?.toLowerCase().includes(q) ||
          r.subject_code?.toLowerCase().includes(q) ||
          r.requester_name?.toLowerCase().includes(q) ||
          r.requested_by_email?.toLowerCase().includes(q) ||
          r.grade_level?.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [allRequests, filter, search]);

  const totalPages = Math.ceil(filteredRequests.length / PAGE_SIZE) || 1;
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const paginatedRequests = filteredRequests.slice(startIndex, endIndex);

  const handleApprove = async (requestId) => {
    setProcessingId(requestId);
    try {
      const targetReq = allRequests.find((r) => r.id === requestId);
      if (!targetReq) throw new Error("Request not found");

      await subjectService.approveSubjectRequest(requestId, targetReq, user?.id);

      notify.success("Subject request approved and published to curriculum successfully!");
      window.dispatchEvent(new CustomEvent("subject-requests-changed"));
      window.dispatchEvent(new CustomEvent("pending-subject-requests-changed"));
      window.dispatchEvent(new CustomEvent("subjects-changed"));
      fetchRequests();
    } catch (err) {
      console.error("Error approving request:", err);
      notify.error(err.message || "Failed to approve request");
    } finally {
      setProcessingId(null);
    }
  };

  const openRejectModal = (request) => {
    setRejectModalTarget(request);
    setRejectReason("");
  };

  const confirmReject = async () => {
    if (!rejectReason.trim()) {
      notify.error("Please provide a reason for rejection");
      return;
    }

    if (!rejectModalTarget) return;

    setProcessingId(rejectModalTarget.id);
    try {
      await subjectService.rejectSubjectRequest(
        rejectModalTarget.id,
        rejectModalTarget,
        rejectReason.trim(),
        user?.id
      );

      notify.success("Subject request rejected");
      setRejectModalTarget(null);
      setRejectReason("");
      window.dispatchEvent(new CustomEvent("subject-requests-changed"));
      window.dispatchEvent(new CustomEvent("pending-subject-requests-changed"));
      fetchRequests();
    } catch (err) {
      console.error("Error rejecting request:", err);
      notify.error(err.message || "Failed to reject request");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDirectCreate = async (e) => {
    e.preventDefault();
    setCreatingSubject(true);

    try {
      const subjectNameTrimmed = newSubject.subject_name.trim();
      if (!subjectNameTrimmed) {
        notify.error("Subject name is required");
        return;
      }

      await subjectService.createDirectSubject({
        subject_name: subjectNameTrimmed,
        subject_code: newSubject.subject_code.trim() || null,
        grade_level: newSubject.grade_level || "1st",
        description: newSubject.description.trim() || null,
        creatorId: user?.id,
      });

      notify.success("Subject created and published to curriculum successfully!");
      window.dispatchEvent(new CustomEvent("subjects-changed"));
      setNewSubject({
        subject_name: "",
        subject_code: "",
        grade_level: "1st",
        description: "",
      });
      setShowCreateForm(false);
      fetchRequests();
    } catch (err) {
      console.error("Error creating subject:", err);
      notify.error(err.message || "Failed to create subject");
    } finally {
      setCreatingSubject(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: "bg-amber-50 text-amber-700 border-amber-200/80",
      approved: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
      rejected: "bg-rose-50 text-rose-700 border-rose-200/80",
    };
    const labels = {
      pending: "Pending Review",
      approved: "Approved",
      rejected: "Rejected",
    };
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-bold rounded-full border ${
          styles[status] || styles.pending
        }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            status === "approved"
              ? "bg-emerald-500"
              : status === "rejected"
              ? "bg-rose-500"
              : "bg-amber-400"
          }`}
        />
        <span>{labels[status] || status}</span>
      </span>
    );
  };

  const getGradeLabel = (gradeLevel) => {
    const labels = {
      "1st": "1st Year",
      "2nd": "2nd Year",
      "3rd": "3rd Year",
      "4th": "4th Year",
    };
    return labels[gradeLevel] || gradeLevel;
  };

  const tabs = [
    { key: "all", label: "All Requests", count: allRequests.length },
    {
      key: "pending",
      label: "Pending",
      count: pendingCount,
      dotColor: "bg-amber-400",
    },
    {
      key: "approved",
      label: "Approved",
      count: allRequests.filter((r) => r.request_status === "approved").length,
      dotColor: "bg-emerald-500",
    },
    {
      key: "rejected",
      label: "Rejected",
      count: allRequests.filter((r) => r.request_status === "rejected").length,
      dotColor: "bg-rose-500",
    },
  ];

  return (
    <>
      {/* Hero Banner with consistent Department Head theme */}
      <div className="bg-gradient-to-r from-brand-navy to-brand-indigo px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-brand-gold text-sm font-semibold uppercase tracking-widest mb-1">
              Department Head
            </p>
            <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
              Subject Request Management
              {pendingCount > 0 && (
                <span className="flex items-center gap-2 px-3 py-1 bg-yellow-400/20 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                  <span className="text-sm font-bold text-yellow-300">
                    {pendingCount} pending
                  </span>
                </span>
              )}
            </h1>
            <p className="text-white/60 text-sm mt-1">
              Review, approve, or reject curriculum subject requests submitted by faculty instructors.
            </p>
          </div>

          <button
            onClick={() => setShowCreateForm(true)}
            className="self-start sm:self-auto px-4 py-2.5 bg-brand-gold hover:bg-brand-gold-dark text-brand-navy font-bold rounded-xl text-sm transition-all shadow-xs flex items-center gap-2 cursor-pointer active:scale-98"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span>Create Subject Directly</span>
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* Top Summary Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs flex items-center justify-between hover:border-brand-gold/30 hover:shadow-md transition-all">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Pending Requests
              </p>
              <p className="text-2xl font-black text-brand-navy mt-1">
                {pendingCount}
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs flex items-center justify-between hover:border-brand-gold/30 hover:shadow-md transition-all">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Approved Today
              </p>
              <p className="text-2xl font-black text-emerald-600 mt-1">
                {approvedToday}
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs flex items-center justify-between hover:border-brand-gold/30 hover:shadow-md transition-all">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Total Processed
              </p>
              <p className="text-2xl font-black text-brand-navy mt-1">
                {totalProcessed}
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
        </div>

        {/* Filters and Search Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          {/* Status Tabs */}
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border cursor-pointer ${
                  filter === tab.key
                    ? "bg-brand-navy text-white border-brand-navy shadow-xs"
                    : "bg-white text-slate-700 border-slate-200 hover:border-brand-navy hover:text-brand-navy shadow-2xs"
                }`}
              >
                {tab.dotColor && (
                  <span className={`w-2 h-2 rounded-full ${tab.dotColor}`} />
                )}
                <span>{tab.label}</span>
                <span
                  className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    filter === tab.key
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative flex-1 max-w-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, code, requester..."
              className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-gold/50 shadow-xs"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Direct Create Subject Modal / Form */}
        {showCreateForm && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-md">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-brand-navy">Create New Subject Directly</h3>
                <p className="text-xs text-gray-500">Publish a new subject straight to the curriculum without a request.</p>
              </div>
              <button
                onClick={() => setShowCreateForm(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg p-1"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleDirectCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Subject Name *
                  </label>
                  <input
                    type="text"
                    value={newSubject.subject_name}
                    onChange={(e) =>
                      setNewSubject({ ...newSubject, subject_name: e.target.value })
                    }
                    placeholder="e.g., Database Management"
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-gold text-xs"
                    disabled={creatingSubject}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Subject Code
                  </label>
                  <input
                    type="text"
                    value={newSubject.subject_code}
                    onChange={(e) =>
                      setNewSubject({ ...newSubject, subject_code: e.target.value })
                    }
                    placeholder="e.g., CS301"
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-gold text-xs"
                    disabled={creatingSubject}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Grade Level *
                </label>
                <select
                  value={newSubject.grade_level}
                  onChange={(e) =>
                    setNewSubject({ ...newSubject, grade_level: e.target.value })
                  }
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-gold text-xs"
                  disabled={creatingSubject}
                >
                  {gradeLevels.map((level) => (
                    <option key={level} value={level}>
                      {level} Year
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newSubject.description}
                  onChange={(e) =>
                    setNewSubject({ ...newSubject, description: e.target.value })
                  }
                  placeholder="Brief description of the subject..."
                  rows="3"
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-gold text-xs resize-none"
                  disabled={creatingSubject}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  disabled={creatingSubject}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl font-bold text-xs hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingSubject}
                  className="px-5 py-2 bg-brand-gold text-brand-navy rounded-xl font-bold text-xs hover:bg-brand-gold-dark transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
                >
                  {creatingSubject ? "Creating..." : "Create Subject"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Requests List */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
          {loading ? (
            <div className="p-12 text-center text-xs font-semibold text-gray-400">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-navy mb-3"></div>
              <p>Loading subject requests...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-400">
              No subject requests found in this view.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {paginatedRequests.map((request) => (
                <div
                  key={request.id}
                  className="p-5 hover:bg-slate-50/70 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-bold text-brand-navy text-base">
                        {request.subject_name}
                      </h4>
                      {request.subject_code && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-100 text-slate-700 uppercase tracking-wider border border-slate-200">
                          {request.subject_code}
                        </span>
                      )}
                      {getStatusBadge(request.request_status)}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-gray-500 mb-2">
                      <span className="font-semibold text-gray-700">
                        {getGradeLabel(request.grade_level)}
                      </span>
                      <span>•</span>
                      <span>
                        Requested by:{" "}
                        <strong className="text-gray-800 font-bold">
                          {request.requester_name || request.requested_by_email}
                        </strong>
                      </span>
                      <span>•</span>
                      <span>
                        Requested: {new Date(request.created_at).toLocaleDateString()}
                      </span>
                      {request.reviewed_at && request.request_status === "approved" && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-700 font-semibold">
                            Approved: {new Date(request.reviewed_at).toLocaleDateString()}
                          </span>
                        </>
                      )}
                      {request.reviewed_at && request.request_status === "rejected" && (
                        <>
                          <span>•</span>
                          <span className="text-rose-700 font-semibold">
                            Rejected: {new Date(request.reviewed_at).toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </div>

                    {request.description && (
                      <p className="text-xs text-gray-600 mb-1 max-w-2xl leading-relaxed">
                        {request.description}
                      </p>
                    )}

                    {request.rejection_reason && (
                      <div className="bg-rose-50 border border-rose-200/80 rounded-xl p-3 mt-2 max-w-xl">
                        <p className="text-xs text-rose-800 leading-relaxed">
                          <strong>Rejection reason:</strong> {request.rejection_reason}
                        </p>
                      </div>
                    )}
                  </div>

                  {request.request_status === "pending" && (
                    <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                      <button
                        onClick={() => handleApprove(request.id)}
                        disabled={processingId === request.id}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer active:scale-98"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{processingId === request.id ? "Processing..." : "Approve"}</span>
                      </button>
                      <button
                        onClick={() => openRejectModal(request)}
                        disabled={processingId === request.id}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer active:scale-98"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span>Reject</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Unified Pagination Controls Bar */}
          {filteredRequests.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-gray-200 text-xs font-semibold text-gray-600 bg-white">
              <span>
                Showing <strong>{startIndex + 1}</strong>–
                <strong>{Math.min(endIndex, filteredRequests.length)}</strong> of{" "}
                <strong>{filteredRequests.length}</strong> subject requests
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold transition-colors shadow-2xs cursor-pointer"
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    if (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    ) {
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`w-8 h-8 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                            currentPage === page
                              ? "bg-brand-navy text-white shadow-xs"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                        >
                          {page}
                        </button>
                      );
                    } else if (page === currentPage - 2 || page === currentPage + 2) {
                      return <span key={page} className="px-1 text-gray-400">...</span>;
                    }
                    return null;
                  })}
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold transition-colors shadow-2xs cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* In-app Rejection Confirmation Modal */}
      {rejectModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-brand-navy">Reject Subject Request</h3>
                <p className="text-xs text-gray-500">{rejectModalTarget.subject_name}</p>
              </div>
            </div>
            <p className="text-xs text-gray-600 mb-3 leading-relaxed">
              Please provide a clear reason for rejection. This feedback will be sent directly to the requesting instructor.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g., A similar curriculum subject is already active..."
              rows={3}
              className="w-full p-3 border border-gray-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setRejectModalTarget(null);
                  setRejectReason("");
                }}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmReject}
                disabled={!rejectReason.trim() || processingId === rejectModalTarget.id}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {processingId === rejectModalTarget.id ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};