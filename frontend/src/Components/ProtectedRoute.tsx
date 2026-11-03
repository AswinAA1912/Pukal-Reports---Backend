import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

// --------------------
// Props Type
// --------------------
interface ProtectedRouteProps {
  children: ReactNode;
}

// --------------------
// Component
// --------------------
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const session = localStorage.getItem("session");

  if (!session) {
    // If no session, redirect to login
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
