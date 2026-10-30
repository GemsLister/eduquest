import { useState } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "../../hooks/useFocusTrap.jsx";
import { useEscapeKey } from "../../hooks/useEscapeKey.jsx";
import {
  BLOOM_LEVELS,
  bloomsLevelColor,
  isManualLevel,
  levelEditorRoleLabel,
  manualLevelStats,
  modelConfidenceOf,
  modelLevelOf,
  thinkingOrderOf,
} from "../../utils/bloomsLevels.js";

const formatPercent = (confidence) => `${((confidence || 0) * 100).toFixed(1)}%`;

const confidenceColor = (confidence) =>
  confidence >= 0.9 ? "text-green-600" : confidence >= 0.75 ? "text-yellow-600" : "text-red-600";

const formatDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "";

/**
 * The question's Bloom's level. When `onEdit` is given it is a button that
 * opens the level editor.
 */
export const BloomsLevelBadge = ({ item, questionNumber, onEdit, className = "px-2 py-0.5" }) => {
  const classes = `inline-flex items-center gap-1 rounded text-xs font-bold border ${className} ${bloomsLevelColor(item.bloomsLevel)}`;
  if (!onEdit) return <span className={classes}>{item.bloomsLevel}</span>;
  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={`Change Bloom's level for question ${questionNumber} (currently ${item.bloomsLevel})`}
      title="Change Bloom's level"
      className={`${classes} hover:brightness-95 hover:shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60`}
    >
      {item.bloomsLevel}
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.232-6.232a2.5 2.5 0 113.536 3.536L12.536 16.536 8 18l1.464-4.536z" />
      </svg>
    </button>
  );
};

/**
 * The classifier's confidence, or "Manual · <role>" with the classifier's
 * original level underneath when a person set the level.
 */
export const BloomsConfidence = ({ item, align = "end", valueClassName = "font-semibold" }) => {
  if (!isManualLevel(item)) {
    return (
      <span className={`${valueClassName} ${confidenceColor(item.confidence)}`}>
        {formatPercent(item.confidence)}
      </span>
    );
  }
  const modelLevel = modelLevelOf(item);
  const modelPercent = formatPercent(modelConfidenceOf(item));
  const by = item.levelChangedBy;
  // Only the short "Manual" pill stays on one line; the rest wraps so it
  // fits narrow table columns
  return (
    <span
      className={`inline-flex flex-col gap-0.5 min-w-0 max-w-full break-words ${align === "end" ? "items-end text-right" : "items-start text-left"}`}
      title={`Classifier said ${modelLevel} (${modelPercent}). Set by ${by?.name || "a reviewer"} (${levelEditorRoleLabel(by?.role)}).`}
    >
      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-violet-100 text-violet-800 border border-violet-200 whitespace-nowrap">
        Manual
      </span>
      <span className="text-[11px] font-semibold text-violet-800 leading-tight">
        by {levelEditorRoleLabel(by?.role)}
      </span>
      <span className="text-[11px] text-gray-500 leading-tight">
        Classifier: <span className="whitespace-nowrap">{modelLevel} · {modelPercent}</span>
      </span>
    </span>
  );
};

/** "Confidence" label stacked right above the value, for the review cards. */
export const BloomsConfidenceBlock = ({ item, valueClassName = "text-sm font-black", className = "" }) => (
  <div className={`flex flex-col items-end gap-0.5 text-right shrink-0 ${className}`}>
    <span className="text-xs text-gray-500 font-medium">Confidence</span>
    <BloomsConfidence item={item} valueClassName={valueClassName} />
  </div>
);

/** Every level change on a question, with who made it and why. */
export const BloomsLevelHistory = ({ item, className = "mt-3" }) => {
  const history = item?.levelHistory || [];
  if (!history.length) return null;
  const modelLevel = modelLevelOf(item);
  return (
    <div className={`${className} rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-900`}>
      <p className="font-semibold mb-1">Bloom&apos;s level changes</p>
      <ul className="space-y-1.5">
        {history.map((change, i) => (
          <li key={`${change.at}-${i}`}>
            <span className="font-semibold">
              {change.from} → {change.to}
            </span>
            {change.to === modelLevel && " (back to the classifier's level)"}
            <span className="text-violet-700">
              {" "}
              · {change.by?.name || "Unknown"} ({levelEditorRoleLabel(change.by?.role)})
              {change.at && ` · ${formatDate(change.at)}`}
            </span>
            {change.reason && (
              <span className="block mt-0.5 italic text-violet-800 whitespace-pre-wrap">“{change.reason}”</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

/** "3 of 20 levels were set manually (2 by Instructor, 1 by Peer Reviewer)." */
export const ManualLevelNotice = ({ results, className = "mt-4" }) => {
  const { total, byRole } = manualLevelStats(results);
  if (!total) return null;
  const parts = Object.entries(byRole).map(([role, count]) => `${count} by ${levelEditorRoleLabel(role)}`);
  const questionCount = results?.analysis?.length || 0;
  return (
    <div className={`${className} p-3 bg-violet-50 border border-violet-200 rounded-lg text-violet-900 text-sm`}>
      <strong>{total}</strong> of {questionCount} Bloom&apos;s level{questionCount === 1 ? " was" : "s were"} set
      manually ({parts.join(", ")}). Each one shows the classifier&apos;s original level and the reason given.
    </div>
  );
};

/** Dialog for picking a question's Bloom's level; rendered by useBloomsLevelEditor. */
export const BloomsLevelEditModal = ({ item, questionNumber, reasonRequired, saving, onCancel, onSave }) => {
  const [level, setLevel] = useState(item.bloomsLevel);
  const [reason, setReason] = useState("");
  const trapRef = useFocusTrap(true);
  useEscapeKey(onCancel, true);

  const modelLevel = modelLevelOf(item);
  const revertsToModel = isManualLevel(item) && level === modelLevel;
  const canSave = level !== item.bloomsLevel && (!reasonRequired || reason.trim()) && !saving;

  const renderGroup = (order) => (
    <fieldset className="space-y-1.5">
      <legend className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
        {order === "LOTS" ? "Lower-order (LOTS)" : "Higher-order (HOTS)"}
      </legend>
      {BLOOM_LEVELS.filter((l) => thinkingOrderOf(l) === order).map((l) => (
        <label
          key={l}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${
            level === l ? "border-brand-navy bg-brand-navy/5 font-semibold text-brand-navy" : "border-gray-200 hover:bg-gray-50 text-gray-700"
          }`}
        >
          <input
            type="radio"
            name="blooms-level"
            value={l}
            checked={level === l}
            onChange={() => setLevel(l)}
            className="accent-brand-navy"
          />
          <span className="flex-1">{l}</span>
          {l === modelLevel && (
            <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">Classifier</span>
          )}
        </label>
      ))}
    </fieldset>
  );

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <form
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="blooms-level-edit-title"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSave) onSave(level, reason);
        }}
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
      >
        <div className="px-6 pt-5 pb-4 border-b border-gray-200">
          <h3 id="blooms-level-edit-title" className="text-lg font-bold text-brand-navy">
            Change Bloom&apos;s level · Question {questionNumber}
          </h3>
          <p className="text-sm text-gray-600 mt-1 line-clamp-3">{item.questionText}</p>
          <p className="text-xs text-gray-500 mt-2">
            Classifier: <span className="font-semibold text-gray-700">{modelLevel}</span> ·{" "}
            {formatPercent(modelConfidenceOf(item))} confidence
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {renderGroup("LOTS")}
            {renderGroup("HOTS")}
          </div>

          <div>
            <label htmlFor="blooms-level-reason" className="block text-sm font-semibold text-gray-700 mb-1">
              Reason {reasonRequired ? <span className="text-red-600">(required)</span> : <span className="font-normal text-gray-500">(optional)</span>}
            </label>
            <textarea
              id="blooms-level-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="e.g. Students must compute the subnet size, so this is Applying, not Remembering."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
            />
            <p className="text-xs text-gray-500 mt-1">
              {reasonRequired
                ? "The instructor and later reviewers will see this reason."
                : "Reviewers will see this change and your reason."}
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-gray-300 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="bg-brand-gold text-brand-navy px-4 py-2 rounded-lg font-semibold text-sm hover:bg-brand-gold-dark hover:brightness-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
          >
            {saving ? "Saving..." : revertsToModel ? "Revert to Classifier" : "Save Level"}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
};
