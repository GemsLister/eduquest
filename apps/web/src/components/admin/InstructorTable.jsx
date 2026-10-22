import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../supabaseClient.js";
import { ChangePasswordModal } from "./ChangePasswordModal.jsx";
import { getProfileName } from "../../utils/profileName.js";
import { ProfileAvatar } from "../ui/ProfileAvatar.jsx";

export const InstructorTable = ({
  instructors,
  statusLoading,
  onToggleStatus,
}) => {
  const [changePwdTarget, setChangePwdTarget] = useState(null);
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

  const handleChangePwdOpen = (instructor) => {
    setChangePwdTarget({ id: instructor.id, name: getProfileName(instructor) });
    setOpenMenuId(null);
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
          Add one from the &quot;Add Instructor&quot; page.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {instructors.map((instructor) => {
          const fullName = getProfileName(instructor);
          const isDisabled = instructor.is_disabled === true;
          const detailPath = `/admin-dashboard/instructors/${instructor.id}`;
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
              className={`relative bg-white rounded-2xl border shadow-xs transition-all hover:shadow-lg hover:-translate-y-0.5 ${
                isDisabled
                  ? "border-amber-200 bg-amber-50/30"
                  : "border-gray-200"
              }`}
            >
              {/* Disabled overlay indicator */}
              {isDisabled && (
                <div className="absolute top-3 left-3">
                  <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold rounded-full uppercase tracking-wider">
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
                  aria-expanded={openMenuId === instructor.id}
                  aria-label={`Options for ${fullName}`}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
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
                      <Link
                        to={detailPath}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-gold/60"
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
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                        View Details
                      </Link>
                      <button
                        onClick={() => handleChangePwdOpen(instructor)}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-gold/60"
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
                        className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-gold/60 ${
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
                  <ProfileAvatar profile={instructor} muted={isDisabled} />
                  <div className="min-w-0">
                    <Link
                      to={detailPath}
                      className={`block font-bold text-sm truncate hover:text-brand-navy hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 ${
                        isDisabled ? "text-gray-400" : "text-gray-800"
                      }`}
                    >
                      {fullName}
                    </Link>
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
                      Exams
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
                  <span className="flex items-center gap-2 text-[11px] text-gray-400">
                    Joined {createdAt}
                    {!isDisabled && (
                      <span className="flex items-center gap-1 font-semibold text-emerald-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Active
                      </span>
                    )}
                  </span>
                  <Link
                    to={detailPath}
                    className="text-xs font-semibold text-brand-gold-dark hover:text-brand-gold transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {changePwdTarget && (
        <ChangePasswordModal
          target={changePwdTarget}
          onClose={() => setChangePwdTarget(null)}
        />
      )}
    </>
  );
};
