import { Navigate, useLocation } from "react-router-dom";
import { toExamPath } from "../utils/legacyRoutes.js";

// Sends an old "quiz" URL to the matching "exam" URL, keeping query and state
export const LegacyExamRedirect = () => {
  const location = useLocation();
  return (
    <Navigate
      to={`${toExamPath(location.pathname)}${location.search}${location.hash}`}
      state={location.state}
      replace
    />
  );
};
