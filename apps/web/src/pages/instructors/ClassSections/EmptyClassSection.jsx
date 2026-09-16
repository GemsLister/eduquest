export const EmptyClassSection = ({ title, icon, description }) => {
  return (
    <div className="bg-white rounded-2xl p-10 md:p-14 text-center shadow-xs border border-slate-200">
      <div className="w-16 h-16 rounded-2xl bg-brand-navy/10 text-brand-navy flex items-center justify-center mx-auto mb-4">
        {icon && typeof icon !== "string" ? (
          icon
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-8 h-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.75}
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            <line x1="12" y1="6" x2="12" y2="12" />
            <line x1="9" y1="9" x2="15" y2="9" />
          </svg>
        )}
      </div>
      <h3 className="text-base md:text-lg font-bold text-slate-800 mb-1">
        {title || "No Subjects Found"}
      </h3>
      <p className="text-xs md:text-sm text-slate-500 max-w-sm mx-auto">
        {description || "Create or assign a curriculum subject and section to get started."}
      </p>
    </div>
  );
};
