import { useState, useCallback } from "react";
import { useEscapeKey } from "../../hooks/useEscapeKey.jsx";
import { useFocusTrap } from "../../hooks/useFocusTrap.jsx";
import { ConfirmContext } from "./ConfirmModal.jsx";

export const ConfirmProvider = ({ children }) => {
  const [state, setState] = useState(null);

  const confirm = useCallback(
    // Confirmations are one short question (the title) and two buttons
    ({
      title,
      confirmText = "Confirm",
      cancelText = "Cancel",
      variant = "danger",
    }) => {
      return new Promise((resolve) => {
        setState({ title, confirmText, cancelText, variant, resolve });
      });
    },
    [],
  );

  const handleResolve = (result) => {
    state?.resolve(result);
    setState(null);
  };

  useEscapeKey(() => handleResolve(false), Boolean(state));
  const trapRef = useFocusTrap(Boolean(state));

  const variantStyles = {
    danger: {
      button: "bg-red-600 hover:bg-red-700 text-white",
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
      icon: "M6 18L18 6M6 6l12 12",
    },
    warning: {
      button: "bg-brand-gold hover:bg-brand-gold-dark text-brand-navy",
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
      icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z",
    },
    success: {
      button: "bg-green-600 hover:bg-green-700 text-white",
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      icon: "M5 13l4 4L19 7",
    },
    info: {
      button: "bg-brand-navy hover:bg-brand-indigo text-white",
      iconBg: "bg-brand-navy/10",
      iconColor: "text-brand-navy",
      icon: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    },
  };

  const currentVariant = variantStyles[state?.variant] || variantStyles.danger;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      {state && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => handleResolve(false)}
          />
          <div
            ref={trapRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 animate-scale-in"
          >
            <div className="flex flex-col items-center text-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${currentVariant.iconBg}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${currentVariant.iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={currentVariant.icon} />
                </svg>
              </div>
              <h3 id="confirm-modal-title" className="text-base font-bold text-brand-navy">
                {state.title}
              </h3>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => handleResolve(false)}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
              >
                {state.cancelText}
              </button>
              <button
                onClick={() => handleResolve(true)}
                autoFocus
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 ${currentVariant.button}`}
              >
                {state.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-scale-in { animation: scaleIn 0.2s ease-out; }
      `}</style>
    </ConfirmContext.Provider>
  );
};
