/** Accumulate time spent; stored to one decimal place (0.1s). */
export function addTimeSpent(existing, deltaSeconds) {
  const a = Number(existing) || 0;
  const b = Number(deltaSeconds) || 0;
  return Math.round((a + b) * 10) / 10;
}

/** Human-readable duration with tenths of a second when useful. */
export function formatTimeSpent(seconds) {
  if (seconds === undefined || seconds === null) return "N/A";
  const s = Number(seconds);
  if (Number.isNaN(s) || s <= 0) return "0.0s";

  const mins = Math.floor(s / 60);
  const secPart = s - mins * 60;

  if (mins > 0) {
    return `${mins}m ${secPart.toFixed(1)}s`;
  }
  return `${s.toFixed(1)}s`;
}
