import { useEffect, useLayoutEffect, useRef } from "react";

// Open layers in the order they opened, so Escape closes only the topmost one
// (a confirm dialog shown over a modal shouldn't close both)
const escapeStack = [];

/**
 * Calls `onEscape` when the Escape key is pressed while `active` is true.
 * Used to let keyboard users dismiss modals.
 */
export const useEscapeKey = (onEscape, active = true) => {
  const handlerRef = useRef(onEscape);
  useLayoutEffect(() => {
    handlerRef.current = onEscape;
  });

  useEffect(() => {
    if (!active) return;
    const token = {};
    escapeStack.push(token);
    const handleKeyDown = (e) => {
      if (e.key !== "Escape") return;
      if (escapeStack[escapeStack.length - 1] !== token) return;
      handlerRef.current?.(e);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const i = escapeStack.indexOf(token);
      if (i !== -1) escapeStack.splice(i, 1);
    };
  }, [active]);
};
