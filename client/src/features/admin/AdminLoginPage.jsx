import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { usePageAssets } from "@/lib/usePageAssets";
import { adminProfiles } from "@/styles/adminProfiles";
import { useAdminAuth } from "@/store/AdminAuthContext";
import { adminApi } from "./adminApi";
import { Preloader, usePreloaderVisible } from "@/components/layout/Preloader";
import "@/styles/admin-modern.css";

export function AdminLoginPage() {
  usePageAssets("admin", "minimal", adminProfiles);
  const showPreloader = usePreloaderVisible();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { refreshAdmin } = useAdminAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await adminApi.login({ email, password });
      if (res?.success) {
        toast.success("Signed in successfully");
        await refreshAdmin();
        navigate("/admin/dashboard");
      } else {
        toast.error(res?.message || "Login failed");
      }
    } catch (err) {
      toast.error(err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-shell">
      {showPreloader && <Preloader />}
      <div className="adm-login">
        <div className="adm-login__visual">
          <div className="adm-login__brand">
            <img src="/assets/admin2/imgs/theme/logoCrownify.png" alt="Crownify" />
            CROWNIFY
          </div>
          <div className="adm-login__copy">
            <h2>Manage your store with confidence.</h2>
            <p>Track orders, curate the catalog, and keep every Crownify customer moving from browse to checkout without friction.</p>
          </div>
          <div style={{ position: "relative", zIndex: 1, color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Admin Console</div>
        </div>

        <div className="adm-login__form-side">
          <div className="adm-login__card">
            <h1>Sign in</h1>
            <p>Admin access only. Use your Crownify staff credentials.</p>

            <form onSubmit={handleSubmit}>
              <div className="adm-field">
                <label className="form-label" htmlFor="email">
                  Email address
                </label>
                <input type="email" className="form-control" id="email" placeholder="you@crownify.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
              </div>

              <div className="adm-field">
                <label className="form-label" htmlFor="password">
                  Password
                </label>
                <div className="adm-login__pw">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="form-control"
                    id="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    style={{ paddingRight: 42 }}
                  />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>
                    <i className="material-icons" style={{ fontSize: 20 }}>
                      {showPassword ? "visibility_off" : "visibility"}
                    </i>
                  </button>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: 6, padding: "11px 15px" }} disabled={submitting}>
                {submitting ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
