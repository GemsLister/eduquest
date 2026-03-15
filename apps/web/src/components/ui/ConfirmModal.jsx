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

  const variantColors = {
    danger: "bg-red-600 hover:bg-red-700",
    warning: "bg-yellow-500 hover:bg-yellow-600 text-gray-900",
    success: "bg-green-600 hover:bg-green-700",
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
          <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 animate-scale-in">
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              {state.title}
            </h3>
            <p className="text-gray-600 text-sm mb-6 whitespace-pre-line">
              {state.message}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => handleResolve(false)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                {state.cancelText}
              </button>
              <button
                onClick={() => handleResolve(true)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors ${variantColors[state.variant]}`}
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
