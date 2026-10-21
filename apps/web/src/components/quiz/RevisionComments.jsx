/**
 * Review comments shown in the quiz editor: `comments` is a list of
 * { author, text } (e.g. "Aleckxa Layocan (Senior Faculty)", "Department Head").
 */
export const RevisionComments = ({ comments, title = null, className = "" }) => {
  if (!comments?.length) return null;
  return (
    <div className={`p-3 rounded-lg border border-amber-200 bg-amber-50 space-y-2 ${className}`}>
      {title && <p className="text-sm font-bold text-brand-navy">{title}</p>}
      {comments.map((c, i) => (
        <div key={i}>
          <p className="text-xs font-semibold text-amber-700">{c.author}:</p>
          <p className="text-sm text-amber-900 whitespace-pre-wrap">{c.text}</p>
        </div>
      ))}
    </div>
  );
};
