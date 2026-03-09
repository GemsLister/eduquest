import { useState, useEffect, useCallback } from "react";
import { adminService } from "../../services/adminService.js";

export const useAdminInstructors = () => {
  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(null); // stores id being deleted

  const fetchInstructors = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: fetchError } = await adminService.getInstructors();
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setInstructors(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchInstructors();
  }, [fetchInstructors]);

  const createInstructor = async (formData) => {
    setCreateLoading(true);
    setError("");
    const { data, error: createError } =
      await adminService.createInstructor(formData);
    setCreateLoading(false);
    if (createError) {
      const message =
        typeof createError === "string"
          ? createError
          : createError.message || "Failed to create instructor";
      setError(message);
      return { success: false, error: message };
    }
    // Refresh the list after creation
    await fetchInstructors();
    return { success: true, data };
  };

  const deleteInstructor = async (userId) => {
    setDeleteLoading(userId);
    setError("");
    const { error: deleteError } = await adminService.deleteInstructor(userId);
    setDeleteLoading(null);
    if (deleteError) {
      const message =
        typeof deleteError === "string"
          ? deleteError
          : deleteError.message || "Failed to delete instructor";
      setError(message);
      return { success: false, error: message };
    }
    setInstructors((prev) => prev.filter((i) => i.id !== userId));
    return { success: true };
  };

  return {
    instructors,
    loading,
    error,
    createLoading,
    deleteLoading,
    fetchInstructors,
    createInstructor,
    deleteInstructor,
  };
};
