import { useState } from "react";
import { adminService } from "../../services/adminService.js";
import { logAudit } from "../../services/auditService.js";
import { useConfirm } from "../../components/ui/ConfirmModal.jsx";
import { notify } from "../../utils/notify.jsx";
import { getProfileName } from "../../utils/profileName.js";

/**
 * Confirm, disable/enable and log an instructor account. Shared by the
 * Instructors list and the instructor detail page.
 */
export const useInstructorStatusToggle = () => {
  const confirm = useConfirm();
  const [statusLoading, setStatusLoading] = useState(null); // id being updated

  // Resolves to the new is_disabled value, or null if cancelled / failed
  const toggleStatus = async (instructor) => {
    const name = getProfileName(instructor, "this instructor");
    const disable = !instructor.is_disabled;

    const confirmed = await confirm(
      disable
        ? {
            title: "Disable Account",
            message: `Disable ${name}'s account? They won't be able to log in, but their exams and results are kept. You can enable the account again later.`,
            confirmText: "Disable",
            variant: "warning",
          }
        : {
            title: "Enable Account",
            message: `Enable ${name}'s account? They will be able to log in again.`,
            confirmText: "Enable",
            variant: "success",
          },
    );
    if (!confirmed) return null;

    setStatusLoading(instructor.id);
    const { error } = await adminService.toggleInstructorStatus(instructor.id, disable);
    setStatusLoading(null);

    if (error) {
      notify.error(
        typeof error === "string" ? error : error.message || "Failed to update account status",
      );
      return null;
    }

    logAudit({
      action: disable ? "ACCOUNT_DISABLED" : "ACCOUNT_ENABLED",
      tableName: "profiles",
      recordId: instructor.id,
      itemName: name,
      previousStatus: disable ? "active" : "disabled",
      newStatus: disable ? "disabled" : "active",
    });
    notify.success(disable ? `${name} has been disabled.` : `${name} has been enabled.`);
    return disable;
  };

  return { statusLoading, toggleStatus };
};
