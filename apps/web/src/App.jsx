import { Outlet } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import { ConfirmProvider } from "./components/ui/ConfirmModal.jsx";

function App() {
  return (
    <ConfirmProvider>
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar />
      <Outlet />
    </ConfirmProvider>
  );
}

export default App;
