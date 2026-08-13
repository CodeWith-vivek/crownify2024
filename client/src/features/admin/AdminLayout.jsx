import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { usePageAssets } from "@/lib/usePageAssets";
import { adminProfiles } from "@/styles/adminProfiles";
import { useAdminAuth } from "@/store/AdminAuthContext";
import { adminApi } from "./adminApi";
import { Preloader, usePreloaderVisible } from "@/components/layout/Preloader";
import "@/styles/admin-modern.css";

const NAV = [
  {
    label: "Overview",
    items: [
      { to: "/admin/dashboard", icon: "space_dashboard", label: "Dashboard" },
      { to: "/admin/sales-report", icon: "insights", label: "Sales Report" },
    ],
  },
  {
    label: "Catalog",
    items: [
      { to: "/admin/products", icon: "inventory_2", label: "Products" },
      { to: "/admin/addProducts", icon: "add_box", label: "Add Product" },
      { to: "/admin/category", icon: "category", label: "Categories" },
      { to: "/admin/brands", icon: "loyalty", label: "Brands" },
    ],
  },
  {
    label: "Commerce",
    items: [
      { to: "/admin/orderlist", icon: "receipt_long", label: "Orders" },
      { to: "/admin/coupon-management", icon: "sell", label: "Coupons" },
    ],
  },
  {
    label: "People",
    items: [
      { to: "/admin/users", icon: "group", label: "Customers" },
      { to: "/admin/contactMessages", icon: "forum", label: "Enquiries" },
    ],
  },
];

const TITLES = {
  "/admin/dashboard": "Dashboard",
  "/admin/sales-report": "Sales Report",
  "/admin/products": "Products",
  "/admin/addProducts": "Add Product",
  "/admin/category": "Categories",
  "/admin/brands": "Brands",
  "/admin/orderlist": "Orders",
  "/admin/coupon-management": "Coupons",
  "/admin/users": "Customers",
  "/admin/contactMessages": "Enquiries",
};

function titleFor(pathname) {
  if (TITLES[pathname]) return TITLES[pathname];
  if (pathname.startsWith("/admin/orderDetails")) return "Order Details";
  if (pathname.startsWith("/admin/editProduct")) return "Edit Product";
  if (pathname.startsWith("/admin/editCategory")) return "Edit Category";
  return "Admin";
}

export function AdminLayout() {
  usePageAssets("admin", "header2", adminProfiles);
  const showPreloader = usePreloaderVisible();

  const { refreshAdmin } = useAdminAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  const handleLogout = async (e) => {
    e.preventDefault();
    try {
      await adminApi.logout();
    } catch {
      // ignore — clearing local state below regardless
    } finally {
      await refreshAdmin();
      navigate("/admin/login");
    }
  };

  return (
    <div className={`admin-shell${sidebarOpen ? " is-sidebar-open" : ""}`}>
      {showPreloader && <Preloader />}
      <div className="adm-backdrop" onClick={() => setSidebarOpen(false)}></div>

      <aside className="adm-sidebar">
        <Link to="/admin/dashboard" className="adm-sidebar__brand">
          <img src="/assets/admin2/imgs/theme/logoCrownify.png" alt="Crownify" />
          <span className="adm-sidebar__brand-text">
            <span className="adm-sidebar__brand-name">CROWNIFY</span>
            <span className="adm-sidebar__brand-sub">Admin</span>
          </span>
        </Link>

        <nav className="adm-sidebar__nav">
          {NAV.map((group) => (
            <div key={group.label}>
              <div className="adm-sidebar__label">{group.label}</div>
              {group.items.map((item) => (
                <NavLink key={item.to} to={item.to} className={({ isActive }) => `adm-navlink${isActive ? " is-active" : ""}`}>
                  <i className="material-icons">{item.icon}</i>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="adm-sidebar__footer">
          <a href="#" className="adm-navlink" onClick={handleLogout}>
            <i className="material-icons">logout</i>
            <span>Logout</span>
          </a>
        </div>
      </aside>

      <div className="adm-main">
        <header className="adm-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button className="adm-iconbtn adm-sidebar-toggle" onClick={() => setSidebarOpen((v) => !v)} aria-label="Toggle navigation">
              <i className="material-icons">menu</i>
            </button>
            <h1 className="adm-topbar__title">{titleFor(pathname)}</h1>
          </div>

          <div className="adm-topbar__actions">
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "inline-flex" }}
                aria-label="Account menu"
              >
                <img className="adm-avatar" src="/assets/admin2/imgs/theme/logoCrownify.png" alt="Admin" />
              </button>
              {menuOpen && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "calc(100% + 8px)",
                    background: "#fff",
                    border: "1px solid var(--adm-border)",
                    borderRadius: "var(--adm-radius-sm)",
                    boxShadow: "var(--adm-shadow-lg)",
                    minWidth: 180,
                    padding: 6,
                    zIndex: 1030,
                  }}
                >
                  <a
                    href="#"
                    onClick={handleLogout}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      padding: "9px 11px",
                      borderRadius: 6,
                      color: "var(--adm-danger)",
                      textDecoration: "none",
                      fontSize: 14,
                      fontWeight: 540,
                    }}
                  >
                    <i className="material-icons" style={{ fontSize: 19 }}>
                      logout
                    </i>
                    Logout
                  </a>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="adm-content">
          <Outlet />
        </main>

        <footer className="adm-footer">
          <span>© {new Date().getFullYear()} Crownify</span>
          <span>All rights reserved</span>
        </footer>
      </div>
    </div>
  );
}
