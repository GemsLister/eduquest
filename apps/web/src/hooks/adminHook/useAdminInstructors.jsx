import { useState, useEffect, useCallback } from "react";
import { adminService } from "../../services/adminService.js";
import { logAudit } from "../../services/auditService.js";
import { getProfileName } from "../../utils/profileName.js";

const accountName = (profile) => getProfileName(profile, "Instructor");

export const useAdminInstructors = () => {
  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  const applyInstructors = useCallback(({ data, error: fetchError }) => {
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setError("");
      setInstructors(data || []);
    }
    setLoading(false);
  }, []);

  const fetchInstructors = useCallback(async () => {
    setLoading(true);
    setError("");
    applyInstructors(await adminService.getInstructors());
  }, [applyInstructors]);

  // Initial load; `loading` already starts out true
  useEffect(() => {
    let cancelled = false;
    adminService.getInstructors().then((result) => {
      if (!cancelled) applyInstructors(result);
    });
    return () => {
      cancelled = true;
    };
  }, [applyInstructors]);

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
    logAudit({
      action: "INSTRUCTOR_CREATED",
      tableName: "profiles",
      recordId: data?.user?.id || null,
      itemName: accountName({
        first_name: formData.firstName,
        last_name: formData.lastName,
        username: formData.username,
        email: formData.email,
      }),
      changeSummary: `Account created for ${formData.email}.`,
    });
    // Refresh the list after creation
    await fetchInstructors();
    return { success: true, data };
  };

  // Reflect a disable/enable done through useInstructorStatusToggle
  const setInstructorDisabled = (userId, disabled) => {
    setInstructors((prev) =>
      prev.map((instructor) =>
        instructor.id === userId
          ? { ...instructor, is_disabled: disabled }
          : instructor,
      ),
    );
  };

  return {
    instructors,
    loading,
    error,
    createLoading,
    fetchInstructors,
    createInstructor,
    setInstructorDisabled,
  };
};
