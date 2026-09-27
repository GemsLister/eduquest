import { Outlet } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import { ConfirmProvider } from "./components/ui/ConfirmModal.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";

function App() {
  return (
    <AuthProvider>
      <ConfirmProvider>
        <ToastContainer
          position="top-right"
          autoClose={4000}
          hideProgressBar
          theme="light"
          style={{ zIndex: 999999 }}
        />
        <Outlet />
      </ConfirmProvider>
    </AuthProvider>
  );
}

export default App;
