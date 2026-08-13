import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/store/AuthContext";
import { Preloader } from "./Preloader";

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Must be a Preloader, not null. Returning null meant no page mounted
  // while /api/auth/me was in flight, so no page stylesheets were
  // registered — the layout's preloader saw "nothing loading", dismissed
  // itself, and the bare Header/Footer painted unstyled until auth
  // resolved and the real page finally loaded its CSS.
  if (loading) return <Preloader />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  return <Outlet />;
}
