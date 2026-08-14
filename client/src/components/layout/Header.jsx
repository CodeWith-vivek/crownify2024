import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/store/AuthContext";

export function Header() {
  const { user, cartCount, wishlistCount, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobilePagesOpen, setMobilePagesOpen] = useState(false);
  const [mobileUserMenuOpen, setMobileUserMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const [stuck, setStuck] = useState(false);

  const userDropdownRef = useRef(null);
  const userMenuRef = useRef(null);

  // Sticky header. The theme's CSS defines the whole behaviour —
  // .classicHeader:not(.stickyNav) is position:absolute, .stickyNav is
  // position:fixed;top:0 — but the class was applied by the theme's jQuery
  // (public/assets/js/main.js), which was deleted along with the EJS views.
  // Nothing has added .stickyNav since, so the header simply scrolled away.
  //
  // Same breakpoint (>1199px) and threshold (145px) the original used, so
  // it re-sticks at exactly the same point it always did. Desktop-only is
  // deliberate — on mobile the fixed header would eat scarce vertical
  // space, which is why the original gated it too.
  useEffect(() => {
    const STICKY_AFTER = 145;
    const DESKTOP_MIN_WIDTH = 1200;

    const update = () => {
      if (window.innerWidth < DESKTOP_MIN_WIDTH) {
        setStuck(false);
        return;
      }
      setStuck(window.scrollY > STICKY_AFTER);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    // The original only recomputed on scroll, so resizing from desktop to
    // mobile left a fixed header stranded until the next scroll.
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  // The dropdowns previously only closed by clicking their own toggle or a
  // link inside them — clicking anywhere else on the page left them hanging
  // open. The original theme got this from jQuery; it needed reimplementing
  // rather than porting.
  useEffect(() => {
    if (!userDropdownOpen && !mobileUserMenuOpen) return;

    const handlePointerDown = (event) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) {
        setUserDropdownOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setMobileUserMenuOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key !== "Escape") return;
      setUserDropdownOpen(false);
      setMobileUserMenuOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [userDropdownOpen, mobileUserMenuOpen]);

  const handleLogout = async (e) => {
    e.preventDefault();
    setUserDropdownOpen(false);
    await logout();
    toast.success("Signed out");
    navigate("/");
  };

  return (
    <>
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
            <div className="col-2 col-sm-4 col-md-3 col-lg-4 text-right" ref={userMenuRef}>
              {/* A real <button>, not a clickable <span> whose only content
                  was an aria-hidden icon — that combination is invisible to
                  screen readers and unreachable by keyboard. */}
              <button
                type="button"
                className="user-menu d-block d-lg-none"
                aria-label="Account menu"
                aria-expanded={mobileUserMenuOpen}
                onClick={() => setMobileUserMenuOpen((o) => !o)}
                style={{ cursor: "pointer", border: "none", background: "none", padding: 0 }}
              >
                <i className="anm anm-user-al" aria-hidden="true"></i>
              </button>
              <ul className="customer-links list-inline" style={{ display: mobileUserMenuOpen ? "block" : undefined }}>
                {user ? (
                  <li>
                    <Link to="/" onClick={() => setMobileUserMenuOpen(false)}>
                      {/* name is required by the schema, but a Google
                          profile without a displayName would render
                          "undefined" here rather than crash. */}
                      {user.name ? user.name.split(" ")[0] : "Account"}
                    </Link>
                  </li>
                ) : (
                  <>
                    <li>
                      <Link to="/login" onClick={() => setMobileUserMenuOpen(false)}>
                        SIGN IN
                      </Link>
                    </li>
                    {/* Was a bare <span> directly inside the <ul>, which is
                        invalid — only <li> may be a child of a list. */}
                    <li aria-hidden="true">/</li>
                    <li>
                      <Link to="/signup" onClick={() => setMobileUserMenuOpen(false)}>
                        SIGN UP
                      </Link>
                    </li>
                  </>
                )}
                <li style={{ paddingRight: 61 }}>
                  <Link to="/faq" onClick={() => setMobileUserMenuOpen(false)}>
                    FAQS
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className={`header-wrap classicHeader animated d-flex${stuck ? " stickyNav fadeInDown" : ""}`}>
        <div className="container-fluid">
          <div className="row align-items-center">
            <div className="logo col-md-2 col-lg-2 d-none d-lg-block">
              <Link to="/">
                <img className="logo1" src="/assets/images/logoCrownify.webp" alt="Crownify" title="CROWNIFY" width={75} height={75} />
              </Link>
            </div>
            <div className="col-2 col-sm-3 col-md-3 col-lg-8">
              <div className="d-block d-lg-none">
                <button
                  type="button"
                  className={`btn--link site-header__menu js-mobile-nav-toggle${mobileNavOpen ? " mobile-nav--close" : " mobile-nav--open"}`}
                  aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
                  onClick={() => setMobileNavOpen((o) => !o)}
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
                  <img src="/assets/images/logoCrownify.webp" className="logo2" alt="Crownify" title="CROWNIFY" width={75} height={75} />
                </Link>
              </div>
            </div>
            <div className="col-4 col-sm-3 col-md-3 col-lg-2 d-flex align-items-center justify-content-end">
              <div className="site-header__wishlist">
                <Link to="/wishlist" className="wishlist-trigger" title="Wishlist">
                  <i className="icon anm anm-heart-l" style={{ position: "relative", top: 3 }}></i>
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
                <div className="dropdown" style={{ display: "inline-block" }} ref={userDropdownRef}>
                  <button
                    className="btn dropdown-toggle"
                    type="button"
                    id="userDropdown"
                    aria-expanded={userDropdownOpen}
                    aria-label="User account"
                    onClick={() => setUserDropdownOpen((o) => !o)}
                    style={{ display: "inline-flex", alignItems: "center", padding: 0, border: "none", background: "none" }}
                  >
                    <i className="fa-solid fa-user" style={{ color: "#e14141", fontSize: 22 }}></i>
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
      <div
        className={`mobile-nav-wrapper${mobileNavOpen ? " active" : ""}`}
        role="navigation"
        style={{ width: "100%", left: mobileNavOpen ? 0 : "-100%" }}
      >
        <div className="closemobileMenu" onClick={() => setMobileNavOpen(false)}>
          <i className="icon anm anm-times-l pull-right"></i> Close Menu
        </div>
        <ul id="MobileNav" className="mobile-nav">
          <li className="lvl1 parent megamenu">
            <Link to="/" onClick={() => setMobileNavOpen(false)}>
              Home
            </Link>
          </li>
          <li className="lvl1 parent megamenu">
            <Link to="/brand" onClick={() => setMobileNavOpen(false)}>
              Brand
            </Link>
          </li>
          <li className="lvl1 parent megamenu">
            <Link to="/shop" onClick={() => setMobileNavOpen(false)}>
              Shop
            </Link>
          </li>
          <li className="lvl1 parent megamenu">
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setMobilePagesOpen((o) => !o);
              }}
            >
              Pages <i className={mobilePagesOpen ? "anm anm-minus-l" : "anm anm-plus-l"}></i>
            </a>
            <ul style={{ display: mobilePagesOpen ? "block" : "none" }}>
              <li>
                <Link to="/About" className="site-nav" onClick={() => setMobileNavOpen(false)}>
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/contact" className="site-nav" onClick={() => setMobileNavOpen(false)}>
                  Contact Us
                </Link>
              </li>
              <li>
                <Link to="/faq" className="site-nav" onClick={() => setMobileNavOpen(false)}>
                  FAQs
                </Link>
              </li>
            </ul>
          </li>
        </ul>
      </div>

      <div className="container-fluid crownify d-flex justify-content-center align-items-center">
        <img src="/assets/images/logo/Crownify_logo_text.webp" className="custom-logo" alt="" />
      </div>
    </>
  );
}
