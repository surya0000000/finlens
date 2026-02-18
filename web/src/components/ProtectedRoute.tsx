import { Navigate } from "react-router-dom";

import type { PropsWithChildren } from "react";

import { useAuth } from "../context/AuthContext";
import { LoadingState } from "./LoadingState";

export const ProtectedRoute = ({ children }: PropsWithChildren) => {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingState label="Preparing workspace..." />;
  }

  if (!token) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

