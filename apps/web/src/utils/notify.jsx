import { toast } from "react-toastify";

const variants = {
  success: {
    headerBg: "bg-emerald-700 text-white",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-700",
    border: "border-emerald-500",
    icon: "M5 13l4 4L19 7",
    title: "Success",
  },
  error: {
    headerBg: "bg-red-700 text-white",
    iconBg: "bg-red-100",
    iconColor: "text-red-700",
    border: "border-red-500",
    icon: "M6 18L18 6M6 6l12 12",
    title: "Error",
  },
  warning: {
    headerBg: "bg-amber-600 text-white",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-700",
    border: "border-amber-500",
    icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z",
    title: "Warning",
  },
  info: {
    headerBg: "bg-blue-700 text-white",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-700",
    border: "border-blue-500",
    icon: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    title: "Info",
  },
};

const NotifyContent = ({ message, variant, closeToast }) => {
  const v = variants[variant] || variants.info;
  return (
    <div className={`flex flex-col rounded-xl overflow-hidden shadow-2xl border-2 ${v.border} bg-white max-w-md w-full`}>
      <div className={`${v.headerBg} px-4 py-2 flex items-center justify-between font-bold text-sm`}>
        <div className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d={v.icon} />
          </svg>
          <span>{v.title}</span>
        </div>
        <button
          onClick={closeToast}
          className="text-white/80 hover:text-white hover:bg-white/20 p-1 rounded-full transition-colors"
          title="Close notification"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
      <div className="px-4 py-3 flex items-start gap-3 bg-white">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${v.iconBg}`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-4 w-4 ${v.iconColor}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d={v.icon}
            />
          </svg>
        </div>
        <p className="text-slate-900 font-semibold text-sm pt-0.5 leading-snug break-words">{message}</p>
      </div>
    </div>
  );
};

const toastOptions = {
  icon: false,
  closeButton: false,
  style: {
    padding: 0,
    background: "transparent",
    boxShadow: "none",
    borderRadius: "12px",
    overflow: "hidden",
  },
  bodyStyle: {
    padding: 0,
    margin: 0,
  },
  className: "!p-0 !bg-transparent !shadow-none !overflow-visible",
};

export const notify = {
  success: (message) =>
    toast(
      ({ closeToast }) => (
        <NotifyContent
          message={message}
          variant="success"
          closeToast={closeToast}
        />
      ),
      toastOptions,
    ),
  error: (message) =>
    toast(
      ({ closeToast }) => (
        <NotifyContent
          message={message}
          variant="error"
          closeToast={closeToast}
        />
      ),
      toastOptions,
    ),
  warning: (message) =>
    toast(
      ({ closeToast }) => (
        <NotifyContent
          message={message}
          variant="warning"
          closeToast={closeToast}
        />
      ),
      toastOptions,
    ),
  info: (message) =>
    toast(
      ({ closeToast }) => (
        <NotifyContent
          message={message}
          variant="info"
          closeToast={closeToast}
        />
      ),
      toastOptions,
    ),
};
