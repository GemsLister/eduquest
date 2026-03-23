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
    const renderWidget = () => {
      if (!containerRef.current || !window.turnstile) return;
      // Clear previous widget if any
      if (widgetIdRef.current !== null) {
        window.turnstile.remove(widgetIdRef.current);
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
      const interval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(interval);
          renderWidget();
        }
      }, 100);
      return () => clearInterval(interval);
    }

    return () => {
      if (widgetIdRef.current !== null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
  }, [handleToken, onToken]);

  return <div ref={containerRef} className="mt-4" />;
};
