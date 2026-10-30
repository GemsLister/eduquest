/**
 * A button label that keeps the width of its longest text, so swapping
 * "Save as Draft" for "Saving..." doesn't resize the button and shift the
 * buttons next to it. Both texts are laid over each other; only one shows.
 */
export const StableLabel = ({ busy, label, busyLabel }) => (
  <span className="inline-grid text-center">
    <span className={`col-start-1 row-start-1 ${busy ? "invisible" : ""}`} aria-hidden={busy || undefined}>
      {label}
    </span>
    <span className={`col-start-1 row-start-1 ${busy ? "" : "invisible"}`} aria-hidden={!busy || undefined}>
      {busyLabel}
    </span>
  </span>
);
