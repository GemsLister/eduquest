import { useState } from "react";
import { adminService } from "../../services/adminService.js";
import { toast } from "react-toastify";

export const InstructorTable = ({
  instructors,
  statusLoading,
  onToggleStatus,
}) => {
  const [changePwdTarget, setChangePwdTarget] = useState(null); // { id, name }
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);

  const getInstructorName = (instructor) =>
    instructor.first_name || instructor.last_name
      ? `${instructor.first_name || ""} ${instructor.last_name || ""}`.trim()
      : instructor.email;

  const handleChangePwdOpen = (instructor) => {
    const name = getInstructorName(instructor);
    setChangePwdTarget({ id: instructor.id, name });
    setNewPassword("");
    setShowNewPassword(false);
  };

  const handleChangePwdSubmit = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setPwdLoading(true);
    const { error } = await adminService.changeInstructorPassword(
      changePwdTarget.id,
      newPassword,
    );
    setPwdLoading(false);
    if (error) {
      toast.error(
        typeof error === "string" ? error : "Failed to change password",
      );
    } else {
      toast.success("Password changed successfully");
      setChangePwdTarget(null);
    }
  };

  if (instructors.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-4xl mb-3">👥</p>
        <p className="font-semibold text-lg">No instructors yet</p>
        <p className="text-sm mt-1">
          Create one using the &quot;Create Instructor&quot; page.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="bg-hornblende-green text-white">
            <tr>
              <th className="px-5 py-4 font-semibold">Name</th>
              <th className="px-5 py-4 font-semibold">Username</th>
              <th className="px-5 py-4 font-semibold">Email</th>
              <th className="px-5 py-4 font-semibold">Status</th>
              <th className="px-5 py-4 font-semibold">Date Created</th>
              <th className="px-5 py-4 font-semibold text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {instructors.map((instructor) => {
              const fullName = getInstructorName(instructor);
              const isDisabled = instructor.is_disabled === true;
              const createdAt = instructor.created_at
                ? new Date(instructor.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })
                : "—";

              return (
                <tr
                  key={instructor.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-5 py-4 font-medium text-gray-800">
                    {fullName}
                  </td>
                  <td className="px-5 py-4 text-gray-600">
                    {instructor.username || "—"}
                  </td>
                  <td className="px-5 py-4 text-gray-600">
                    {instructor.email || "—"}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        isDisabled
                          ? "bg-amber-100 text-amber-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {isDisabled ? "Disabled" : "Active"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-gray-500">{createdAt}</td>
                  <td className="px-5 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleChangePwdOpen(instructor)}
                        className="px-3 py-1.5 text-xs font-semibold text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
                      >
                        Change Password
                      </button>
                      <button
                        onClick={() => onToggleStatus(instructor)}
                        disabled={statusLoading === instructor.id}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          isDisabled
                            ? "text-green-700 border border-green-300 hover:bg-green-50"
                            : "text-amber-700 border border-amber-300 hover:bg-amber-50"
                        }`}
                      >
                        {statusLoading === instructor.id
                          ? isDisabled
                            ? "Enabling..."
                            : "Disabling..."
                          : isDisabled
                            ? "Enable Account"
                            : "Disable Account"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Change Password Modal */}
      {changePwdTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-bold text-gray-800 mb-1">
              Change Password
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              Set a new password for{" "}
              <span className="font-semibold text-gray-700">
                {changePwdTarget.name}
              </span>
              .
            </p>
            <div className="relative mb-5">
              <input
                type={showNewPassword ? "text" : "password"}
                placeholder="New password (min. 6 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 pr-16 text-sm focus:outline-none focus:border-casual-green"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-sea-green transition-colors"
              >
                {showNewPassword ? "Hide" : "Show"}
              </button>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setChangePwdTarget(null)}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleChangePwdSubmit}
                disabled={pwdLoading}
                className="flex-1 px-4 py-2.5 bg-casual-green text-white rounded-lg font-semibold text-sm hover:bg-hornblende-green transition-colors disabled:opacity-50"
              >
                {pwdLoading ? "Saving..." : "Save Password"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
