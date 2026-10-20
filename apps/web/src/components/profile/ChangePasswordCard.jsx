import { useState } from "react";
import { supabase } from "../../supabaseClient.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { notify } from "../../utils/notify.jsx";

// Same rules as the password recovery page
const passwordRules = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "One uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { label: "One lowercase letter", test: (p) => /[a-z]/.test(p) },
  { label: "One number", test: (p) => /[0-9]/.test(p) },
  { label: "One special character", test: (p) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p) },
];

const inputClass =
  "w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm text-brand-navy placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-gold/20 focus:border-brand-gold transition-all";

/**
 * In-app password change for any signed-in role. Accounts that already have
 * an email/password login must confirm their current password first;
 * Google-only accounts can set a password directly.
 */
export const ChangePasswordCard = () => {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [saving, setSaving] = useState(false);

  const providers = user?.app_metadata?.providers || [user?.app_metadata?.provider];
  const hasPasswordLogin = providers.includes("email");

  const allRulesPass = passwordRules.every((r) => r.test(newPassword));
  const matches = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit =
    allRulesPass && matches && (!hasPasswordLogin || currentPassword.length > 0) && !saving;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit || !user?.email) return;
    setSaving(true);
    try {
      if (hasPasswordLogin) {
        const { error: verifyError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        });
        if (verifyError) {
          notify.error("Your current password is incorrect.");
          return;
        }
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      notify.success("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error("Change password error:", err);
      notify.error(err.message || "Failed to update password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 bg-white rounded-2xl shadow-xs border border-gray-200 p-6"
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">
          {hasPasswordLogin ? "Change Password" : "Set a Password"}
        </h3>
        <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showPasswords}
            onChange={(e) => setShowPasswords(e.target.checked)}
            className="accent-brand-navy"
          />
          Show passwords
        </label>
      </div>

      {!hasPasswordLogin && (
        <p className="text-xs text-gray-500 mb-4">
          You sign in with Google. Setting a password also lets you sign in with your email.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {hasPasswordLogin && (
          <div>
            <label htmlFor="pw-current" className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
              Current Password
            </label>
            <input
              id="pw-current"
              type={showPasswords ? "text" : "password"}
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputClass}
            />
          </div>
        )}
        <div>
          <label htmlFor="pw-new" className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
            New Password
          </label>
          <input
            id="pw-new"
            type={showPasswords ? "text" : "password"}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="pw-confirm" className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
            Confirm New Password
          </label>
          <input
            id="pw-confirm"
            type={showPasswords ? "text" : "password"}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputClass}
          />
          {confirmPassword && !matches && (
            <p className="text-[11px] text-rose-600 mt-1">Passwords don't match.</p>
          )}
        </div>
      </div>

      <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-x-4 gap-y-1">
        {passwordRules.map((rule) => {
          const ok = rule.test(newPassword);
          return (
            <li
              key={rule.label}
              className={`text-[11px] flex items-center gap-1.5 ${ok ? "text-emerald-600" : "text-gray-400"}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-gray-300"}`} />
              {rule.label}
            </li>
          );
        })}
      </ul>

      <div className="flex justify-end mt-5">
        <button
          type="submit"
          disabled={!canSubmit}
          className="px-5 py-2.5 bg-brand-navy hover:bg-brand-indigo text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
        >
          {saving ? "Updating..." : "Update Password"}
        </button>
      </div>
    </form>
  );
};
