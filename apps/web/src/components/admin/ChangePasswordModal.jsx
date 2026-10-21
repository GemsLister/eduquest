import { useState } from "react";
import { adminService } from "../../services/adminService.js";
import { logAudit } from "../../services/auditService.js";
import { notify } from "../../utils/notify.jsx";
import { useEscapeKey } from "../../hooks/useEscapeKey.jsx";
import { useFocusTrap } from "../../hooks/useFocusTrap.jsx";

/**
 * Senior Faculty sets a new password for an instructor.
 * `target` is { id, name }; render only while it is set.
 */
export const ChangePasswordModal = ({ target, onClose }) => {
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const trapRef = useFocusTrap(true);
  useEscapeKey(() => {
    if (!loading) onClose();
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      notify.error("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    const { error } = await adminService.changeInstructorPassword(target.id, newPassword);
    setLoading(false);
    if (error) {
      notify.error(typeof error === "string" ? error : "Failed to change password");
      return;
    }
    notify.success("Password changed successfully");
    logAudit({
      action: "PASSWORD_RESET",
      tableName: "profiles",
      recordId: target.id,
      itemName: target.name,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <form
        ref={trapRef}
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-label="Change password"
        className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4 border border-slate-200"
      >
        <div className="w-12 h-12 rounded-xl bg-brand-navy/10 flex items-center justify-center mb-4 text-brand-navy">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-gray-800 mb-1">Change Password</h3>
        <p className="text-sm text-gray-500 mb-5">
          Set a new password for{" "}
          <span className="font-semibold text-gray-700">{target.name}</span>.
        </p>
        <div className="relative mb-5">
          <label htmlFor="change-password-input" className="sr-only">
            New password
          </label>
          <input
            id="change-password-input"
            type={showNewPassword ? "text" : "password"}
            placeholder="New password (min. 8 characters)"
            autoComplete="new-password"
            autoFocus
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 pr-16 text-sm text-brand-navy placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-gold/20 focus:border-brand-gold shadow-2xs transition-all"
          />
          <button
            type="button"
            onClick={() => setShowNewPassword(!showNewPassword)}
            aria-label={showNewPassword ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-brand-navy transition-colors cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
          >
            {showNewPassword ? "Hide" : "Show"}
          </button>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-lg font-bold text-xs hover:bg-slate-50 transition-all shadow-2xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-brand-gold text-brand-navy rounded-lg font-bold text-xs hover:bg-brand-gold-dark hover:brightness-95 hover:shadow-lg active:brightness-90 transition-all shadow-xs disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
          >
            {loading ? "Saving..." : "Save Password"}
          </button>
        </div>
      </form>
    </div>
  );
};
