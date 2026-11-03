import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./authContext";

export const RequireAuth: React.FC<{ children: JSX.Element }> = ({ children }) => {
  const { token, isInitializing } = useAuth();

  if (isInitializing) return <div>Loading...</div>;

  return token ? children : <Navigate to="/login" replace />;
};
