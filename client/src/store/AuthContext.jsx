import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [cartCount, setCartCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const refreshMe = useCallback(async () => {
    try {
      const data = await apiClient.get("/api/auth/me");
      setUser(data?.user ?? null);
      setCartCount(data?.cartCount ?? 0);
      setWishlistCount(data?.wishlistCount ?? 0);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  // Session expiry, raised by apiClient on any 401. Clears local auth state
  // and routes to the matching login screen so a stale session can't leave
  // the user stuck on a protected page full of failed requests.
  useEffect(() => {
    const onUnauthorized = (event) => {
      const isAdmin = event.detail?.admin;
      if (isAdmin) {
        if (!location.pathname.startsWith("/admin/login")) navigate("/admin/login");
        return;
      }
      setUser(null);
      setCartCount(0);
      setWishlistCount(0);
      if (location.pathname !== "/login") {
        toast.error("Your session expired. Please sign in again.");
        navigate("/login");
      }
    };
    window.addEventListener("auth:unauthorized", onUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", onUnauthorized);
  }, [navigate, location.pathname]);

  // Clears the server session, then the local state. Local state is cleared
  // even if the request fails so the UI can never get stuck showing a
  // logged-in header for a session the server has already dropped.
  const logout = useCallback(async () => {
    try {
      await apiClient.get("/api/logout");
    } finally {
      setUser(null);
      setCartCount(0);
      setWishlistCount(0);
    }
  }, []);

  const value = {
    user,
    loading,
    cartCount,
    wishlistCount,
    setCartCount,
    setWishlistCount,
    refreshMe,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
