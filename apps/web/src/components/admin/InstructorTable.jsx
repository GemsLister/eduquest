import { useState, useEffect } from "react";
import { adminService } from "../../services/adminService.js";
import { supabase } from "../../supabaseClient.js";
import { notify } from "../../utils/notify.jsx";

export const InstructorTable = ({
  instructors,
  statusLoading,
  onToggleStatus,
}) => {
  const [changePwdTarget, setChangePwdTarget] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [quizCounts, setQuizCounts] = useState({});

  // Load quiz counts for all instructors
  useEffect(() => {
    const loadQuizCounts = async () => {
      if (instructors.length === 0) return;
      const ids = instructors.map((i) => i.id);
      const { data, error } = await supabase
        .from("quizzes")
        .select("instructor_id, is_published")
        .in("instructor_id", ids);

      if (!error && data) {
        const counts = {};
        data.forEach((q) => {
          if (!counts[q.instructor_id]) {
            counts[q.instructor_id] = { total: 0, published: 0 };
          }
          counts[q.instructor_id].total++;
          if (q.is_published) counts[q.instructor_id].published++;
        });
        setQuizCounts(counts);
      }
    };
    loadQuizCounts();
  }, [instructors]);

  const getInstructorName = (instructor) =>
    instructor.first_name || instructor.last_name
      ? `${instructor.first_name || ""} ${instructor.last_name || ""}`.trim()
      : instructor.username || instructor.email;

  const getInitials = (instructor) => {
    if (instructor.first_name || instructor.last_name) {
      const f = (instructor.first_name || "")[0] || "";
      const l = (instructor.last_name || "")[0] || "";
      return (f + l).toUpperCase() || "?";
    }
    if (instructor.username) return instructor.username[0].toUpperCase();
    return (instructor.email || "?")[0].toUpperCase();
  };

  const avatarColors = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-purple-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-cyan-500",
    "bg-indigo-500",
    "bg-teal-500",
  ];

  const getAvatarColor = (id) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return avatarColors[Math.abs(hash) % avatarColors.length];
  };

  const handleChangePwdOpen = (instructor) => {
    const name = getInstructorName(instructor);
    setChangePwdTarget({ id: instructor.id, name });
    setNewPassword("");
    setShowNewPassword(false);
    setOpenMenuId(null);
  };

  const handleChangePwdSubmit = async () => {
    if (!newPassword || newPassword.length < 6) {
      notify.error("Password must be at least 6 characters");
      return;
    }
    setPwdLoading(true);
    const { error } = await adminService.changeInstructorPassword(
      changePwdTarget.id,
      newPassword,
    );
    setPwdLoading(false);
    if (error) {
      notify.error(
        typeof error === "string" ? error : "Failed to change password",
      );
    } else {
      notify.success("Password changed successfully");
      setChangePwdTarget(null);
    }
  };

  const handleToggleClick = (instructor) => {
    setOpenMenuId(null);
    onToggleStatus(instructor);
  };

  if (instructors.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-2xl flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </div>
        <p className="font-semibold text-lg">No instructors yet</p>
        <p className="text-sm mt-1">
          Create one using the &quot;Create Instructor&quot; page.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {instructors.map((instructor) => {
          const fullName = getInstructorName(instructor);
          const isDisabled = instructor.is_disabled === true;
          const initials = getInitials(instructor);
          const color = getAvatarColor(instructor.id);
          const stats = quizCounts[instructor.id] || {
            total: 0,
            published: 0,
          };
          const createdAt = instructor.created_at
            ? new Date(instructor.created_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : "—";

          return (
            <div
              key={instructor.id}
              className={`relative bg-white rounded-xl border shadow-sm transition-all hover:shadow-md ${
                isDisabled
                  ? "border-amber-200 bg-amber-50/30"
                  : "border-gray-200"
              }`}
            >
              {/* Disabled overlay indicator */}
              {isDisabled && (
                <div className="absolute top-3 left-3">
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full uppercase tracking-wider">
                    Disabled
                  </span>
                </div>
              )}

              {/* 3-dot menu */}
              <div className="absolute top-3 right-3">
                <button
                  onClick={() =>
                    setOpenMenuId(
                      openMenuId === instructor.id ? null : instructor.id,
                    )
                  }
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 5v.01M12 12v.01M12 19v.01"
                    />
                  </svg>
                </button>

                {openMenuId === instructor.id && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setOpenMenuId(null)}
                    />
                    <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1 min-w-[180px]">
                      <button
                        onClick={() => handleChangePwdOpen(instructor)}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 text-gray-400"
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
                        Change Password
                      </button>
                      <button
                        onClick={() => handleToggleClick(instructor)}
                        disabled={statusLoading === instructor.id}
                        className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors disabled:opacity-50 ${
                          isDisabled
                            ? "text-green-600 hover:bg-green-50"
                            : "text-amber-600 hover:bg-amber-50"
                        }`}
                      >
                        {isDisabled ? (
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
                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        ) : (
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
                              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                            />
                          </svg>
                        )}
                        {statusLoading === instructor.id
                          ? isDisabled
                            ? "Enabling..."
                            : "Disabling..."
                          : isDisabled
                            ? "Enable Account"
                            : "Disable Account"}
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Card Content */}
              <div className="p-5 pt-6">
                {/* Avatar + Name */}
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${
                      isDisabled ? "bg-gray-400" : color
                    }`}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p
                      className={`font-bold text-sm truncate ${
                        isDisabled ? "text-gray-400" : "text-gray-800"
                      }`}
                    >
                      {fullName}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      @{instructor.username || "—"}
                    </p>
                  </div>
                </div>

                {/* Email */}
                <div className="flex items-center gap-2 mb-3 text-xs text-gray-500">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3.5 w-3.5 text-gray-400 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  <span className="truncate">{instructor.email || "—"}</span>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-gray-50 rounded-lg px-2.5 py-2 text-center">
                    <p className="text-sm font-bold text-gray-700">
                      {stats.total}
                    </p>
                    <p className="text-[10px] text-gray-400 font-medium">
                      Quizzes
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-2.5 py-2 text-center">
                    <p className="text-sm font-bold text-green-600">
                      {stats.published}
                    </p>
                    <p className="text-[10px] text-gray-400 font-medium">
                      Published
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-2.5 py-2 text-center">
                    <p className="text-sm font-bold text-indigo-600">
                      {stats.total - stats.published}
                    </p>
                    <p className="text-[10px] text-gray-400 font-medium">
                      Drafts
                    </p>
                  </div>
                </div>

                {/* Footer: Date + Status */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <span className="text-[11px] text-gray-400">
                    Joined {createdAt}
                  </span>
                  {!isDisabled && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-green-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      Active
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Change Password Modal */}
      {changePwdTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-blue-600"
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
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 pr-16 text-sm focus:outline-none focus:border-brand-gold"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-brand-navy transition-colors"
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
                className="flex-1 px-4 py-2.5 bg-brand-gold text-brand-navy rounded-lg font-semibold text-sm hover:bg-brand-gold-dark transition-colors disabled:opacity-50"
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
