import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable='true']",
].join(",");

// Open traps in the order they opened; only the topmost one handles Tab, so a
// confirm dialog over a modal keeps focus in the confirm dialog
const trapStack = [];

const getFocusable = (container) =>
  [...container.querySelectorAll(FOCUSABLE)].filter(
    (el) => el.getClientRects().length > 0 && !el.closest("[inert]"),
  );

/**
 * Keeps keyboard focus inside a modal while `active` is true: focus moves into
 * the modal when it opens, Tab / Shift+Tab wrap around inside it, and focus
 * returns to whatever was focused before once it closes.
 *
 * Attach the returned ref to the dialog element.
 */
export const useFocusTrap = (active = true) => {
  const ref = useRef(null);

  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;

    const previouslyFocused = document.activeElement;
    const token = {};
    trapStack.push(token);

    if (!container.hasAttribute("tabindex")) container.setAttribute("tabindex", "-1");
    // Leave autoFocus fields alone; otherwise start on the first control
    if (!container.contains(document.activeElement)) {
      (getFocusable(container)[0] || container).focus({ preventScroll: true });
    }

    const handleKeyDown = (e) => {
      if (e.key !== "Tab" || trapStack[trapStack.length - 1] !== token) return;
      const items = getFocusable(container);
      if (items.length === 0) {
        e.preventDefault();
        container.focus({ preventScroll: true });
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      if (!container.contains(current)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && (current === first || current === container)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const i = trapStack.indexOf(token);
      if (i !== -1) trapStack.splice(i, 1);
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [active]);

  return ref;
};
