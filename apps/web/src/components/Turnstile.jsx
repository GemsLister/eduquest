import { useEffect, useRef, useCallback } from "react";

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

export const Turnstile = ({ onToken }) => {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);

  const handleToken = useCallback(
    (token) => {
      onToken(token);
    },
    [onToken],
  );

  useEffect(() => {
    // If no site key, just call onToken with a dummy token immediately for dev
    if (!SITE_KEY) {
      onToken("dummy-token-for-dev");
      return;
    }

    let intervalId = null;

    const renderWidget = () => {
      if (!containerRef.current || !window.turnstile) return;
      // Clear previous widget if any
      if (widgetIdRef.current !== null) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Widget already removed
        }
        widgetIdRef.current = null;
      }
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        callback: handleToken,
        "expired-callback": () => onToken(null),
        "error-callback": () => onToken(null),
        theme: "light",
        size: "flexible",
      });
    };

    // Turnstile script may not be loaded yet
    if (window.turnstile) {
      renderWidget();
    } else {
      intervalId = setInterval(() => {
        if (window.turnstile) {
          clearInterval(intervalId);
          intervalId = null;
          renderWidget();
        }
      }, 100);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (widgetIdRef.current !== null && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Widget already removed
        }
        widgetIdRef.current = null;
      }
    };
  }, [handleToken, onToken]);

  return SITE_KEY ? <div ref={containerRef} className="mt-4" /> : null;
};
