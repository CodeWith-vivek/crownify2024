import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { apiClient } from "@/lib/apiClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [cartCount, setCartCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [loading, setLoading] = useState(true);

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

  const value = {
    user,
    loading,
    cartCount,
    wishlistCount,
    setCartCount,
    setWishlistCount,
    refreshMe,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
