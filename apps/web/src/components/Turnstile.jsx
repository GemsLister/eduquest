import { useEffect, useRef, useCallback } from "react";

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

export const Turnstile = ({ onToken }) => {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const isConfigured = SITE_KEY && SITE_KEY.trim().length > 0;

  if (!isConfigured) {
    console.error(
      "Cloudflare Turnstile site key is missing. Set VITE_TURNSTILE_SITE_KEY in your environment."
    );
    // Signal parent form that captcha is unavailable
    if (onToken) onToken(null);
    return (
      <div className="mt-4 text-sm text-red-600">
        Turnstile is not configured. Please set VITE_TURNSTILE_SITE_KEY.
      </div>
    );
  }

  const handleToken = useCallback(
    (token) => {
      onToken(token);
    },
    [onToken],
  );

  useEffect(() => {
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

  return <div ref={containerRef} className="mt-4" />;
};
