import React from "react";
import { RequireAuth } from "./AuthRouteGuards";

export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <RequireAuth>{children}</RequireAuth>;
};
