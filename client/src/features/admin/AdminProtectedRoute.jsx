import { Navigate, Outlet } from "react-router-dom";
import { useAdminAuth } from "@/store/AdminAuthContext";
import { Preloader } from "@/components/layout/Preloader";

export function AdminProtectedRoute() {
  const { isAdmin, loading } = useAdminAuth();

  // Preloader rather than null — see the note in ProtectedRoute: returning
  // null lets the layout dismiss its preloader before any page has
  // registered its stylesheets, flashing unstyled chrome.
  if (loading) return <Preloader />;
  if (!isAdmin) return <Navigate to="/admin/login" replace />;

  return <Outlet />;
}
