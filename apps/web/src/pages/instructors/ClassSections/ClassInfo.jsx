import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const cardThemes = [
  {
    gradient: "from-brand-navy to-brand-indigo",
    button: "bg-brand-gold hover:bg-brand-gold-dark text-brand-navy",
    statBg: "bg-brand-navy/5",
    statText: "text-brand-navy",
  },
  {
    gradient: "from-brand-indigo to-brand-indigo-dark",
    button: "bg-brand-gold hover:bg-brand-gold-dark text-brand-navy",
    statBg: "bg-brand-indigo/5",
    statText: "text-brand-indigo",
  },
  {
    gradient: "from-brand-indigo-dark to-brand-navy",
    button: "bg-brand-gold hover:bg-brand-gold-dark text-brand-navy",
    statBg: "bg-brand-navy/5",
    statText: "text-brand-navy",
  },
];

export const ClassInfo = ({
  sectionId,
  sectionName,
  subject,
  quizzes = [],
  onEdit,
  onArchive,
  onDelete,
  onAddSection,
  themeIndex = 0,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const theme = cardThemes[themeIndex % cardThemes.length];

  const totalQuizzes = quizzes.length;
  const openQuizzes = quizzes.filter((q) => q.is_open !== false).length;
  const totalAttempts = quizzes.reduce((sum, q) => sum + (q.attempts || 0), 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col justify-between h-full">
      {/* Card Header */}
      <div className={`bg-gradient-to-r ${theme.gradient} p-4 text-white`}>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 pr-2">
            <h3 className="font-bold text-lg leading-snug truncate">
              {sectionName}
            </h3>
            <p className="text-white/70 text-xs mt-0.5 truncate">{subject}</p>
          </div>

          {/* Action menu */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
              aria-label="Section options"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>

            {dropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-1 w-44 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-20 text-gray-700 text-xs">
                  {onAddSection && (
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        onAddSection();
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-brand-navy font-semibold"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                      Add Section
                    </button>
                  )}
                  {onEdit && (
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        onEdit();
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3.5 w-3.5 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                      Edit Section
                    </button>
                  )}
                  {onArchive && (
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        onArchive();
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-amber-600"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3.5 w-3.5 text-amber-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                        />
                      </svg>
                      Archive Section
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        onDelete();
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-red-50 flex items-center gap-2 text-red-600"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3.5 w-3.5 text-red-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                      Delete Section
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4 flex flex-col flex-1">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2 py-3 border-t border-gray-100">
          <div className={`rounded-lg px-2 py-1.5 text-center ${theme.statBg}`}>
            <p className={`text-sm font-bold ${theme.statText}`}>
              {openQuizzes}/{totalQuizzes}
            </p>
            <p className="text-[10px] text-gray-500 font-medium">
              Quizzes Open
            </p>
          </div>
          <div className={`rounded-lg px-2 py-1.5 text-center ${theme.statBg}`}>
            <p className={`text-sm font-bold ${theme.statText}`}>
              {totalAttempts}
            </p>
            <p className="text-[10px] text-gray-500 font-medium">Attempts</p>
          </div>
          <div className={`rounded-lg px-2 py-1.5 text-center ${theme.statBg}`}>
            <p className={`text-sm font-bold ${theme.statText}`}>
              {totalQuizzes > 0 ? Math.round(totalAttempts / totalQuizzes) : 0}
            </p>
            <p className="text-[10px] text-gray-500 font-medium">Avg/Quiz</p>
          </div>
        </div>

        {/* Action */}
        <button
          onClick={() => {
            const isAdminPath = location.pathname.startsWith("/admin-dashboard");
            navigate(isAdminPath ? `/admin-dashboard/section/${sectionId}` : `/instructor-dashboard/section/${sectionId}`);
          }}
          className={`mt-auto w-full py-2.5 rounded-lg font-bold text-sm transition-colors cursor-pointer ${theme.button}`}
        >
          View Subject
        </button>
      </div>
    </div>
  );
};
