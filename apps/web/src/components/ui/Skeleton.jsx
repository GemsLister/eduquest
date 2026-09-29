// Skeleton loading primitives. Use shaped pulse blocks that mirror the
// content being loaded (cards, table rows, profile header) instead of a
// centered spinner. Keeps layout stable while data resolves. Pass `tone`
// instead of a bg-* class so exactly one background utility ever applies.
export const Skeleton = ({ className = "", tone = "bg-slate-200" }) => {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse ${tone} ${className}`}
    />
  );
};

export const SkeletonCard = ({ lines = 3, className = "" }) => {
  return (
    <div
      aria-hidden="true"
      className={`bg-white rounded-2xl border border-slate-200 shadow-xs p-5 ${className}`}
    >
      <Skeleton className="h-5 w-2/3 rounded-md mb-3" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-3 rounded-md mb-2 ${i === lines - 1 ? "w-1/2 mb-0" : "w-full"}`}
        />
      ))}
    </div>
  );
};

export const SkeletonTableRow = ({ cells = 4, className = "" }) => {
  return (
    <div
      aria-hidden="true"
      className={`flex items-center gap-4 px-4 py-3.5 border-b border-slate-100 ${className}`}
    >
      {Array.from({ length: cells }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-3.5 rounded-md ${i === 0 ? "w-1/3" : "w-1/6"}`}
        />
      ))}
    </div>
  );
};
