import { useState, useEffect, useCallback } from "react";
import { adminService } from "../../services/adminService.js";
import { logAudit } from "../../services/auditService.js";
import { getProfileName } from "../../utils/profileName.js";

const accountName = (profile) => getProfileName(profile, "Instructor");

export const useRegistrationRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(null); // { id, action } or null

  const applyRequests = useCallback(({ data, error: fetchError }) => {
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setError("");
      setRequests(data || []);
    }
    setLoading(false);
  }, []);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError("");
    applyRequests(await adminService.getRegistrationRequests());
  }, [applyRequests]);

  // Initial load; `loading` already starts out true
  useEffect(() => {
    let cancelled = false;
    adminService.getRegistrationRequests().then((result) => {
      if (!cancelled) applyRequests(result);
    });
    return () => {
      cancelled = true;
    };
  }, [applyRequests]);

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
    logAudit({
      action: "REGISTRATION_APPROVED",
      tableName: "profiles",
      recordId: userId,
      itemName: accountName(requests.find((r) => r.id === userId)),
      previousStatus: "pending_approval",
      newStatus: "active",
    });
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
    // The account is deleted, so the record id would point at nothing
    const rejected = requests.find((r) => r.id === userId);
    logAudit({
      action: "REGISTRATION_REJECTED",
      tableName: "profiles",
      itemName: accountName(rejected),
      previousStatus: "pending_approval",
      newStatus: "deleted",
      changeSummary: rejected?.email ? `Registration for ${rejected.email} was rejected and deleted.` : null,
    });
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
