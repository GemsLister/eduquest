import { Outlet } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import { ConfirmProvider } from "./components/ui/ConfirmProvider.jsx";
import { AuthProvider } from "./context/AuthProvider.jsx";

function App() {
  return (
    <AuthProvider>
      <ConfirmProvider>
        <ToastContainer position="top-right" autoClose={3000} hideProgressBar />
        <Outlet />
      </ConfirmProvider>
    </AuthProvider>
  );
}

export default App;
