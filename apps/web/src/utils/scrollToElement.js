/**
 * Scrolls the nearest scrollable ancestor so `el` sits `offset` px below its
 * top. Unlike scrollIntoView, it never scrolls the app shell (which is
 * overflow-hidden) or the page behind a dialog.
 */
export const scrollToElementTop = (el, offset = 16) => {
  if (!el) return;
  let container = el.parentElement;
  while (container) {
    const { overflowY } = getComputedStyle(container);
    if ((overflowY === "auto" || overflowY === "scroll") && container.scrollHeight > container.clientHeight) break;
    container = container.parentElement;
  }
  if (!container) return;
  const delta = el.getBoundingClientRect().top - container.getBoundingClientRect().top - offset;
  container.scrollBy({ top: delta, behavior: "smooth" });
};
