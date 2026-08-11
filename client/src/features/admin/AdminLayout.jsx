import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  LayoutDashboard,
  ShoppingBag,
  Users,
  FolderTree,
  Tag,
  Package,
  Ticket,
  Mail,
  LogOut,
} from "lucide-react";
import { useAdminAuth } from "@/store/AdminAuthContext";
import { adminApi } from "./adminApi";

const navItems = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/orderlist", label: "Orders", icon: ShoppingBag },
  { to: "/admin/users", label: "Customers", icon: Users },
  { to: "/admin/category", label: "Categories", icon: FolderTree },
  { to: "/admin/brands", label: "Brands", icon: Tag },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/coupon-management", label: "Coupons", icon: Ticket },
  { to: "/admin/contactMessages", label: "Messages", icon: Mail },
];

export function AdminLayout() {
  const { refreshAdmin } = useAdminAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await adminApi.logout();
    } catch {
      // ignore
    } finally {
      await refreshAdmin();
      toast.success("Logged out");
      navigate("/admin/login");
    }
  };

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 border-r bg-primary text-primary-foreground md:block">
        <div className="p-4">
          <Link to="/admin/dashboard" className="font-heading text-xl font-bold">
            CROWNIFY
          </Link>
          <p className="text-xs text-primary-foreground/60">Admin Panel</p>
        </div>
        <nav className="mt-4 flex flex-col gap-1 px-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive ? "bg-primary-foreground/10 font-medium" : "hover:bg-primary-foreground/5"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
          <button
            onClick={handleLogout}
            className="mt-4 flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-primary-foreground/80 hover:bg-primary-foreground/5"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </nav>
      </aside>

      <main className="flex-1 bg-secondary/30">
        <Outlet />
      </main>
    </div>
  );
}
