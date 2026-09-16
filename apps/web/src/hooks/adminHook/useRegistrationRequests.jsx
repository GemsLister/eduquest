import { useState, useEffect, useCallback } from "react";
import { adminService } from "../../services/adminService.js";

export const useRegistrationRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(null); // { id, action } or null

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: fetchError } =
      await adminService.getRegistrationRequests();
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setRequests(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const approveRequest = async (userId) => {
    setActionLoading({ id: userId, action: "approve" });
    const { error: approveError } =
      await adminService.approveRegistration(userId);
    setActionLoading(null);
    if (approveError) {
      setError(approveError.message || "Failed to approve");
      return { success: false };
    }
    setRequests((prev) => prev.filter((r) => r.id !== userId));
    window.dispatchEvent(new Event("pending-requests-changed"));
    return { success: true };
  };

  const rejectRequest = async (userId) => {
    setActionLoading({ id: userId, action: "reject" });
    const { error: rejectError } =
      await adminService.rejectRegistration(userId);
    setActionLoading(null);
    if (rejectError) {
      setError(
        typeof rejectError === "string"
          ? rejectError
          : rejectError.message || "Failed to reject",
      );
      return { success: false };
    }
    setRequests((prev) => prev.filter((r) => r.id !== userId));
    window.dispatchEvent(new Event("pending-requests-changed"));
    return { success: true };
  };

  return {
    requests,
    loading,
    error,
    actionLoading,
    fetchRequests,
    approveRequest,
    rejectRequest,
  };
};
