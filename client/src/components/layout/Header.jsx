import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/store/AuthContext";

export function Header() {
  const { user, cartCount, wishlistCount, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const handleLogout = async (e) => {
    e.preventDefault();
    setUserDropdownOpen(false);
    await logout();
    toast.success("Signed out");
    navigate("/");
  };

  return (
    <>
      {/* Search Form Drawer */}
      <div className={`search${searchOpen ? " active" : ""}`}>
        <div className="search__form">
          <form className="search-bar__form" action="#" onSubmit={(e) => e.preventDefault()}>
            <button className="go-btn search__button" type="submit">
              <i className="icon anm anm-search-l"></i>
            </button>
            <input
              className="search__input"
              type="search"
              name="q"
              placeholder="Search entire store..."
              aria-label="Search"
              autoComplete="off"
            />
          </form>
          <button type="button" className="search-trigger close-btn" onClick={() => setSearchOpen(false)}>
            <i className="anm anm-times-l"></i>
          </button>
        </div>
      </div>

      {/* Top Header */}
      <div className="top-header">
        <div className="container-fluid">
          <div className="row">
            <div className="col-sm-4 col-md-4 col-lg-4 d-none d-lg-none d-md-block d-lg-block">
              <div className="text-center">
                <p className="top-header_middle-text"> Worldwide Express Shipping</p>
              </div>
            </div>
            <div className="col-10 col-sm-8 col-md-5 col-lg-4"></div>
            <div className="col-2 col-sm-4 col-md-3 col-lg-4 text-right">
              <span className="user-menu d-block d-lg-none">
                <i className="anm anm-user-al" aria-hidden="true"></i>
              </span>
              <ul className="customer-links list-inline">
                {user ? (
                  <li>
                    <Link to="/">{user.name.split(" ")[0]}</Link>
                  </li>
                ) : (
                  <>
                    <li>
                      <Link to="/login">SIGN IN</Link>
                    </li>
                    <span>/</span>
                    <li>
                      <Link to="/signup">SIGN UP</Link>
                    </li>
                  </>
                )}
                <li style={{ paddingRight: 61 }}>
                  <Link to="/faq">FAQS</Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="header-wrap classicHeader animated d-flex">
        <div className="container-fluid">
          <div className="row align-items-center">
            <div className="logo col-md-2 col-lg-2 d-none d-lg-block">
              <Link to="/">
                <img className="logo1" src="/assets/images/logoCrownify.png" alt="Belle Multipurpose Html Template" title="CROWNIFY" width={188} height={188} />
              </Link>
            </div>
            <div className="col-2 col-sm-3 col-md-3 col-lg-8">
              <div className="d-block d-lg-none">
                <button
                  type="button"
                  className="btn--link site-header__menu js-mobile-nav-toggle mobile-nav--open"
                  onClick={() => setMobileNavOpen(true)}
                >
                  <i className="icon anm anm-times-l"></i>
                  <i className="anm anm-bars-r"></i>
                </button>
              </div>
              <nav className="grid__item" id="AccessibleNav">
                <ul id="siteNav" className="site-nav medium center hidearrow">
                  <li className="lvl1 parent megamenu">
                    <Link to="/">
                      Home <i className="anm anm-angle-down-l"></i>
                    </Link>
                  </li>
                  <li className="lvl1 parent megamenu">
                    <Link to="/brand">
                      Brand <i className="anm anm-angle-down-l"></i>
                    </Link>
                  </li>
                  <li className="lvl1 parent megamenu">
                    <Link to="/shop">
                      Shop <i className="anm anm-angle-down-l"></i>
                    </Link>
                  </li>
                  <li className="lvl1 parent dropdown">
                    <a href="#">
                      Pages <i className="anm anm-angle-down-l"></i>
                    </a>
                    <ul className="dropdown">
                      <li>
                        <Link to="/About" className="site-nav">
                          About Us
                        </Link>
                      </li>
                      <li>
                        <Link to="/contact" className="site-nav">
                          Contact Us
                        </Link>
                      </li>
                      <li>
                        <Link to="/faq" className="site-nav">
                          FAQs
                        </Link>
                      </li>
                    </ul>
                  </li>
                  <li className="lvl1 parent dropdown">
                    <Link to="/contact">
                      Contact<i className="anm anm-angle-down-l"></i>
                    </Link>
                  </li>
                </ul>
              </nav>
            </div>
            <div className="col-6 col-sm-6 col-md-6 col-lg-2 d-block d-lg-none mobile-logo">
              <div className="logo">
                <Link to="/">
                  <img src="/assets/images/logoCrownify.png" className="logo2" alt="Belle Multipurpose Html Template" title="CROWNIFY" width={188} height={188} />
                </Link>
              </div>
            </div>
            <div className="col-4 col-sm-3 col-md-3 col-lg-2 d-flex align-items-center justify-content-end">
              <div className="site-header__wishlist">
                <Link to="/wishlist" className="wishlist-trigger" title="Cart">
                  <i className="icon anm anm-heart-l"></i>
                  <span className="wishlist-count">{wishlistCount ? (wishlistCount > 9 ? "10+" : wishlistCount) : "0"}</span>
                </Link>
              </div>
              <div className="site-cart mr-3">
                <Link to="/cart" className="site-header__cart" title="Cart">
                  <i className="icon anm anm-bag-l"></i>
                  <span className="cart-count">{cartCount ? (cartCount > 9 ? "10+" : cartCount) : "0"}</span>
                </Link>
              </div>

              {user && (
                <div className="dropdown" style={{ display: "inline-block" }}>
                  <button
                    className="btn dropdown-toggle"
                    type="button"
                    id="userDropdown"
                    aria-expanded={userDropdownOpen}
                    aria-label="User account"
                    onClick={() => setUserDropdownOpen((o) => !o)}
                  >
                    <i className="fa-solid fa-user" style={{ color: "#e14141" }}></i>
                  </button>
                  <ul
                    className={`dropdown-menu dropdown-menu-start${userDropdownOpen ? " show" : ""}`}
                    aria-labelledby="userDropdown"
                    style={{ right: 0, left: "auto" }}
                  >
                    <li>
                      <Link className="dropdown-item" to="/profile" onClick={() => setUserDropdownOpen(false)}>
                        <i className="fa-solid fa-user"></i> Profile
                      </Link>
                    </li>
                    <li>
                      <Link className="dropdown-item" to="/wallet" onClick={() => setUserDropdownOpen(false)}>
                        <i className="fa-solid fa-wallet"></i> Wallet
                      </Link>
                    </li>
                    <li>
                      <Link className="dropdown-item" to="/orders" onClick={() => setUserDropdownOpen(false)}>
                        <i className="fa-solid fa-box"></i> Orders
                      </Link>
                    </li>
                    <li>
                      <a className="dropdown-item" href="#" onClick={handleLogout}>
                        <i className="fa-solid fa-sign-out-alt"></i> Logout
                      </a>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <div className={`mobile-nav-wrapper${mobileNavOpen ? " mobile-nav--open" : ""}`} role="navigation">
        <div className="closemobileMenu" onClick={() => setMobileNavOpen(false)}>
          <i className="icon anm anm-times-l pull-right"></i> Close Menu
        </div>
        <ul id="MobileNav" className="mobile-nav">
          <li className="lvl1 parent megamenu">
            <Link to="/">
              Home <i className="anm anm-plus-l"></i>
            </Link>
          </li>
          <li className="lvl1 parent megamenu">
            <Link to="/brand">
              Brand <i className="anm anm-plus-l"></i>
            </Link>
          </li>
          <li className="lvl1 parent megamenu">
            <Link to="/shop">
              Shop <i className="anm anm-plus-l"></i>
            </Link>
          </li>
          <li className="lvl1 parent megamenu">
            <a href="#">
              Pages <i className="anm anm-plus-l"></i>
            </a>
            <ul>
              <li>
                <Link to="/About" className="site-nav">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/contact" className="site-nav">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link to="/faq" className="site-nav">
                  FAQs
                </Link>
              </li>
            </ul>
          </li>
        </ul>
      </div>

      <div className="container-fluid crownify d-flex justify-content-center align-items-center">
        <img src="/assets/images/logo/Crownify_logo_text.png" className="custom-logo" alt="" />
      </div>
    </>
  );
}
