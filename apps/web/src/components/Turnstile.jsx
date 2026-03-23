import { useEffect, useRef, useState, useCallback } from "react";

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;
const ENABLE_CAPTCHA_BYPASS = import.meta.env.VITE_DISABLE_TURNSTILE === "true";
const FALLBACK_TEST_KEY = "1x00000000000000000000AA"; // Cloudflare test site key
const TURNSTILE_SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export const Turnstile = ({ onToken }) => {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");

  const hasValidKey = SITE_KEY && SITE_KEY.trim().length > 0;
  const siteKey = hasValidKey ? SITE_KEY.trim() : FALLBACK_TEST_KEY;


  const handleToken = useCallback(
    (token) => {
      setStatus("ready");
      setMessage("");
      if (onToken) onToken(token);
    },
    [onToken],
  );

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !window.turnstile) return;

    if (widgetIdRef.current !== null) {
      try {
        window.turnstile.remove(widgetIdRef.current);
      } catch {
        // Widget already removed
      }
      widgetIdRef.current = null;
    }

    try {
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: handleToken,
        "expired-callback": () => {
          if (onToken) onToken(null);
          setStatus("expired");
        },
        "error-callback": () => {
          if (onToken) onToken(null);
          setStatus("error");
          setMessage(
            "Turnstile verification failed. Check that VITE_TURNSTILE_SITE_KEY is correct and allowed for this origin.",
          );
        },
        theme: "light",
        size: "flexible",
      });

      if (!hasValidKey) {
        setStatus("warning");
        setMessage(
          "Using fallback Turnstile test key. Set VITE_TURNSTILE_SITE_KEY in .env for production.",
        );
      }
    } catch (error) {
      setStatus("error");
      setMessage(
        `Turnstile render fail: ${error?.message || "Unknown error"}. Please check your site key and domain.`,
      );
      if (onToken) onToken(null);
    }
  }, [hasValidKey, onToken, handleToken, siteKey]);

  useEffect(() => {
    if (ENABLE_CAPTCHA_BYPASS) {
      setStatus("ready");
      setMessage("Captcha bypass is enabled for local development.");
      if (onToken) onToken("__captcha_bypass__");
      return;
    }

    if (!hasValidKey) {
      console.warn(
        "Cloudflare Turnstile site key is missing. Using fallback test key. Set VITE_TURNSTILE_SITE_KEY in your environment.",
      );
    }

    if (window.turnstile) {
      renderWidget();
      return;
    }

    let script = document.querySelector('script[data-turnstile-script]');
    if (!script) {
      script = document.createElement("script");
      script.src = TURNSTILE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.setAttribute("data-turnstile-script", "true");
      document.head.appendChild(script);
    }

    const onLoad = () => renderWidget();
    const onError = () => {
      setStatus("error");
      setMessage(
        "Unable to load Cloudflare Turnstile script. Please check your network and CORS settings.",
      );
      if (onToken) onToken(null);
    };

    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);

    return () => {
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
      if (widgetIdRef.current !== null && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Widget already removed
        }
      }
    };
  }, [hasValidKey, onToken, renderWidget]);

  return (
    <div className="mt-4" aria-live="polite">
      <div ref={containerRef} />
      {status === "error" && (
        <p className="text-sm text-red-600 mt-2" role="alert">
          {message}
        </p>
      )}
      {(status === "warning" || status === "expired") && (
        <p className="text-sm text-orange-600 mt-2">{message}</p>
      )}
      {status === "loading" && <p className="text-sm text-gray-500 mt-2">Loading captcha...</p>}
    </div>
  );
};
