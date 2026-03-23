import { createContext, useContext, useState, useCallback } from "react";

const ConfirmContext = createContext(null);

export const useConfirm = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
};

export const ConfirmProvider = ({ children }) => {
  const [state, setState] = useState(null);

  const confirm = useCallback(
    ({
      title,
      message,
      confirmText = "Confirm",
      cancelText = "Cancel",
      variant = "danger",
    }) => {
      return new Promise((resolve) => {
        setState({ title, message, confirmText, cancelText, variant, resolve });
      });
    },
    [],
  );

  const handleResolve = (result) => {
    state?.resolve(result);
    setState(null);
  };

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
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      {state && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => handleResolve(false)}
          />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 animate-scale-in overflow-hidden">
            {/* Header */}
            <div className="bg-brand-navy px-6 py-4">
              <h3 className="text-lg font-bold text-white">
                {state.title}
              </h3>
            </div>

            {/* Body */}
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${variantStyles[state.variant].iconBg}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${variantStyles[state.variant].iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={variantStyles[state.variant].icon} />
                  </svg>
                </div>
                <p className="text-gray-600 text-sm whitespace-pre-line pt-2">
                  {state.message}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => handleResolve(false)}
                className="px-5 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-gray-200 hover:bg-gray-300 transition-colors"
              >
                {state.cancelText}
              </button>
              <button
                onClick={() => handleResolve(true)}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${variantStyles[state.variant].button}`}
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
