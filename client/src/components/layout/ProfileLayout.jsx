import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { usePageAssets } from "@/lib/usePageAssets";
import { userProfiles } from "@/styles/userProfiles";
import { useAuth } from "@/store/AuthContext";

const NAV = [
  { to: "/profile", id: "dashboard-tab", icon: "fi-rs-settings-sliders", label: "Dashboard" },
  { to: "/orders", id: "orders-tab", icon: "fi-rs-shopping-bag", label: "Orders" },
  { to: "/Address", id: "address-tab", icon: "fi-rs-marker", label: "My Address" },
  { to: "/AccountDetails", id: "account-detail-tab", icon: "fi-rs-user", label: "Account details" },
];

export function ProfileLayout() {
  usePageAssets("user", "headerprofile", userProfiles);
  const { pathname } = useLocation();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async (e) => {
    e.preventDefault();
    await logout();
    toast.success("Signed out");
    navigate("/");
  };

  return (
    <>
      <main className="main">
        <div className="page-header breadcrumb-wrap" style={{ backgroundColor: "#291616" }}>
          <div className="container">
            <div className="breadcrumb">
              <Link to="/" rel="nofollow" style={{ color: "aliceblue" }}>
                Home
              </Link>
              <span></span> Pages
              <span></span> Account
            </div>
          </div>
        </div>

        <section className="pt-150 pb-150">
          <div className="container">
            <div className="row">
              <div className="col-lg-12 m-auto">
                <div className="row">
                  <div className="col-md-3">
                    <div className="dashboard-menu">
                      <ul className="nav-flex column">
                        {NAV.map((item) => (
                          <li className="nav-item" key={item.to}>
                            <Link className={`nav-link${pathname === item.to ? " active" : ""}`} id={item.id} to={item.to}>
                              <i className={`${item.icon} mr-10`}></i>
                              {item.label}
                            </Link>
                          </li>
                        ))}
                        <li className="nav-item">
                          <a className="nav-link" href="#" onClick={handleLogout}>
                            <i className="fi-rs-sign-out mr-10"></i>Logout
                          </a>
                        </li>
                      </ul>
                    </div>
                  </div>

                  <Outlet />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
