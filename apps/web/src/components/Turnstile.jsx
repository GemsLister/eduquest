import { useEffect, useRef, useCallback } from "react";

const DEFAULT_SITE_KEY =
  import.meta.env.VITE_TURNSTILE_SITE_KEY || "0x4AAAAAACus2J8DKC1y7hnS";

export const Turnstile = ({
  siteKey = DEFAULT_SITE_KEY,
  action = "login",
  theme = "light",
  size = "flexible",
  onToken,
  onExpire,
  onError,
}) => {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);

  const handleToken = useCallback(
    (token) => {
      onToken?.(token);
    },
    [onToken],
  );

  const handleExpire = useCallback(() => {
    onToken?.(null);
    onExpire?.();
  }, [onToken, onExpire]);

  const handleError = useCallback(
    (code) => {
      console.warn("Turnstile widget error:", code);
      onToken?.(null);
      onError?.(code);
    },
    [onToken, onError],
  );

  useEffect(() => {
    if (!siteKey) {
      onToken?.("dummy-token-for-dev");
      return;
    }

    let intervalId = null;
    let isMounted = true;

    const renderWidget = () => {
      if (!isMounted || !containerRef.current || !window.turnstile) return;

      if (widgetIdRef.current !== null) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {}
        widgetIdRef.current = null;
      }

      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action: action,
          callback: handleToken,
          "expired-callback": handleExpire,
          "error-callback": handleError,
          theme: theme,
          size: size,
        });
      } catch (err) {
        console.error("Turnstile render error:", err);
      }
    };

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
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
      if (widgetIdRef.current !== null && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {}
        widgetIdRef.current = null;
      }
    };
  }, [
    siteKey,
    action,
    theme,
    size,
    handleToken,
    handleExpire,
    handleError,
    onToken,
  ]);

  return siteKey ? (
    <div
      ref={containerRef}
      className="cf-turnstile mt-4 flex justify-center"
      data-sitekey={siteKey}
      data-action={action}
    />
  ) : null;
};

