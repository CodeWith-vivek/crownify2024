import { Navigate, Outlet } from "react-router-dom";
import { useAdminAuth } from "@/store/AdminAuthContext";

export function AdminProtectedRoute() {
  const { isAdmin, loading } = useAdminAuth();

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/admin/login" replace />;

  return <Outlet />;
}
