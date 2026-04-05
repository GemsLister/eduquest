import { toast } from "react-toastify";

const variants = {
  success: {
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
    icon: "M5 13l4 4L19 7",
    title: "Success",
  },
  error: {
    iconBg: "bg-red-100",
    iconColor: "text-red-600",
    icon: "M6 18L18 6M6 6l12 12",
    title: "Error",
  },
  warning: {
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z",
    title: "Warning",
  },
  info: {
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    icon: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    title: "Info",
  },
};

const NotifyContent = ({ message, variant, closeToast }) => {
  const v = variants[variant];
  return (
    <div className="flex flex-col overflow-hidden">
      <div className="bg-brand-navy px-4 py-2 flex items-center justify-between">
        <span className="text-white font-bold text-sm">{v.title}</span>
        <button
          onClick={closeToast}
          className="text-white/60 hover:text-white transition-colors"
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
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d={v.icon}
            />
          </svg>
        </div>
        <p className="text-gray-600 text-sm pt-1">{message}</p>
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
  className: "!p-0 !bg-white !rounded-xl !shadow-2xl !overflow-hidden",
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
