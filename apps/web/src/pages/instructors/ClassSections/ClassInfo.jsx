import { useNavigate } from "react-router-dom";

const cardThemes = [
  {
    gradient: "from-violet-500 to-purple-700",
    button: "bg-violet-600 hover:bg-violet-700",
    dot: "bg-violet-400",
    badge: "bg-violet-50 text-violet-700",
  },
  {
    gradient: "from-sky-500 to-blue-700",
    button: "bg-blue-600 hover:bg-blue-700",
    dot: "bg-sky-400",
    badge: "bg-sky-50 text-blue-700",
  },
  {
    gradient: "from-amber-400 to-orange-600",
    button: "bg-orange-500 hover:bg-orange-600",
    dot: "bg-amber-400",
    badge: "bg-amber-50 text-orange-700",
  },
  {
    gradient: "from-rose-500 to-pink-700",
    button: "bg-rose-600 hover:bg-rose-700",
    dot: "bg-rose-400",
    badge: "bg-rose-50 text-rose-700",
  },
  {
    gradient: "from-hornblende-green to-sea-green",
    button: "bg-hornblende-green hover:bg-dark-aquamarine-green",
    dot: "bg-casual-green",
    badge: "bg-green-50 text-hornblende-green",
  },
];

export const ClassInfo = ({
  sectionId,
  sectionName,
  examCode,
  subject,
  quizCount = 0,
}) => {
  const navigate = useNavigate();
  // Pick a consistent theme based on section name
  const theme = cardThemes[sectionName?.charCodeAt(0) % cardThemes.length];

  return (
    <div className="flex flex-col h-full">
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
        <div>
          <h1 className="text-white font-bold text-lg leading-tight drop-shadow">
            {sectionName}
          </h1>
          <p className="text-white/70 text-xs mt-0.5">{subject}</p>
        </div>
      </div>
      {/* Card Body */}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Exam Code
          </span>
          <span
            className={`ml-auto font-mono font-bold text-xs px-2 py-1 rounded-md ${theme.badge}`}
          >
            {examCode}
          </span>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 py-3 border-t border-gray-100">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${theme.dot}`}></div>
            <span className="text-xs text-gray-500">
              {quizCount} {quizCount === 1 ? "Quiz" : "Quizzes"}
            </span>
          </div>
        </div>

        {/* Action */}
        <button
          onClick={() => navigate(`/instructor-dashboard/section/${sectionId}`)}
          className={`mt-auto w-full text-white py-2.5 rounded-lg font-semibold text-sm transition-colors ${theme.button}`}
        >
          Open Class →
        </button>
      </div>
    </div>
  );
};

