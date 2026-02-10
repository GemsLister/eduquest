import { Outlet } from "react-router-dom";
import { ToastContainer } from "react-toastify";

function App() {
  return (
    <>
      <ToastContainer position="top-right" autoClose={3000} theme="colored" />
      <Outlet />
    </>
  );
}

export default App;
