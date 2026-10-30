// Page numbers with "..." gaps, e.g. 1 … 4 5 6 … 12
const pageNumbers = (current, total) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [1];
  if (current > 3) pages.push("...");
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
};

const NAV_BUTTON =
  "px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60";

/**
 * "Showing 11–20 of 25 questions" with Prev / page numbers / Next, used for
 * every paginated question list (exam editor, analysis, reviews).
 * Renders nothing when everything fits on one page.
 */
export const Pagination = ({
  page,
  pageSize,
  totalItems,
  onChange,
  itemLabel = "questions",
  className = "pt-4 border-t border-gray-200 mt-6",
}) => {
  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <nav
      aria-label={`${itemLabel} pages`}
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 ${className}`}
    >
      <p className="text-sm text-gray-500 font-medium">
        Showing {start}–{end} of {totalItems} {itemLabel}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          aria-label={`Previous ${itemLabel} page`}
          className={NAV_BUTTON}
        >
          Prev
        </button>
        {pageNumbers(page, totalPages).map((p, i) =>
          p === "..." ? (
            <span key={`dots-${i}`} className="px-2 text-sm text-gray-400 select-none">
              ...
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              aria-label={`Go to ${itemLabel} page ${p}`}
              aria-current={p === page ? "page" : undefined}
              className={`w-8 h-8 text-xs font-semibold rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 ${
                p === page
                  ? "bg-brand-gold text-brand-navy font-bold shadow-sm"
                  : "border border-gray-200 bg-white hover:bg-gray-50 text-gray-600"
              }`}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          aria-label={`Next ${itemLabel} page`}
          className={NAV_BUTTON}
        >
          Next
        </button>
      </div>
    </nav>
  );
};
