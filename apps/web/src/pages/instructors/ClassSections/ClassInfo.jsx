import { useState } from "react";
import { useNavigate } from "react-router-dom";

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
}) => {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);

  const theme = cardThemes[sectionName?.charCodeAt(0) % cardThemes.length];

  // Compute stats from quizzes
  const totalQuizzes = quizzes.length;
  const openQuizzes = quizzes.filter((q) => q.is_open !== false).length;
  const totalAttempts = quizzes.reduce((sum, q) => sum + (q.attempts || 0), 0);


  return (
    <div className="flex flex-col h-full relative">
      {/* Card Header */}
      <div
        className={`relative h-24 bg-gradient-to-br ${theme.gradient} flex items-end p-4`}
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Ccircle cx='20' cy='20' r='3'/%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />

        {/* 3-dot menu */}
        <div className="absolute top-2 right-2 z-[2]">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 transition-colors text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01" />
            </svg>
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20 w-36">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onEdit?.();
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Subject
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onArchive?.();
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                  Archive
                </button>
              </div>
            </>
          )}
        </div>

        <div className="relative z-[1]">
          <h1 className="text-white font-bold text-lg leading-tight drop-shadow line-clamp-2">
            {sectionName}
          </h1>
          <p className="text-white/70 text-xs mt-0.5">{subject}</p>
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
            <p className="text-[10px] text-gray-500 font-medium">Quizzes Open</p>
          </div>
          <div className={`rounded-lg px-2 py-1.5 text-center ${theme.statBg}`}>
            <p className={`text-sm font-bold ${theme.statText}`}>
              {totalAttempts}
            </p>
            <p className="text-[10px] text-gray-500 font-medium">Attempts</p>
          </div>
          <div className={`rounded-lg px-2 py-1.5 text-center ${theme.statBg}`}>
            <p className={`text-sm font-bold ${theme.statText}`}>
              {totalQuizzes > 0
                ? Math.round(totalAttempts / totalQuizzes)
                : 0}
            </p>
            <p className="text-[10px] text-gray-500 font-medium">Avg/Quiz</p>
          </div>
        </div>

        {/* Action */}
        <button
          onClick={() => navigate(`/instructor-dashboard/section/${sectionId}`)}
          className={`mt-auto w-full py-2.5 rounded-lg font-bold text-sm transition-colors ${theme.button}`}
        >
          View Subject
        </button>
      </div>
    </div>
  );
};
