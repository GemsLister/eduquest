import { toast } from "react-toastify";
import { NotifyContent } from "./NotifyContent.jsx";

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
