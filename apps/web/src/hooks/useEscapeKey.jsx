import { useEffect, useLayoutEffect, useRef } from "react";

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
    const handleKeyDown = (e) => {
      if (e.key === "Escape") handlerRef.current?.(e);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [active]);
};
