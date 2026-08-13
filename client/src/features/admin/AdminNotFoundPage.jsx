import { Link } from "react-router-dom";

/**
 * Admin 404, ported from the original views/admin/admin-error.ejs.
 *
 * The React router had no catch-all inside the /admin tree at all, so an
 * unknown admin URL fell through to the storefront's global "*" route and
 * rendered the SHOP 404 — complete with the customer-facing header, nav and
 * footer — inside the admin session. This keeps admins in the admin shell.
 */
export function AdminNotFoundPage() {
  return (
    <div className="adm-card">
      <div className="adm-card__body" style={{ textAlign: "center", padding: "56px 24px" }}>
        <img
          src="/assets/admin2/imgs/theme/404.png"
          alt="Page not found"
          style={{ width: "100%", maxWidth: 320, height: "auto", marginBottom: 28 }}
        />
        <h3 style={{ fontSize: 22, fontWeight: 600, marginBottom: 12 }}>Oops! Page not found</h3>
        <p style={{ color: "var(--adm-text-muted, #6b7280)", maxWidth: 480, margin: "0 auto 24px" }}>
          It looks like you may have taken a wrong turn. Don't worry — it happens to the best of us.
        </p>
        <Link to="/admin/dashboard" className="btn btn-primary">
          <i className="material-icons">keyboard_return</i>
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
