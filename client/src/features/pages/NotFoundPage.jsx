import { Link } from "react-router-dom";
import { usePageAssets } from "@/lib/usePageAssets";
import { userProfiles } from "@/styles/userProfiles";

/**
 * Storefront 404, ported from the original views/user/page-404.ejs.
 *
 * The React app previously routed unknown paths to the generic <ComingSoon/>
 * placeholder ("This page is being rebuilt — coming soon"), which told
 * visitors the wrong thing entirely: a mistyped URL isn't an unfinished
 * feature. header404 is the stylesheet profile the EJS page used.
 */
export function NotFoundPage() {
  usePageAssets("user", "header404", userProfiles);

  return (
    <div id="page-content">
      <div className="container">
        <div className="row">
          <div className="col-12 col-sm-12 col-md-12 col-lg-12">
            <div className="empty-page-content text-center" style={{ paddingTop: 40, minHeight: "90vh" }}>
              <div className="empty-cart-content">
                <img
                  src="/assets/images/404.jpg"
                  alt="Page not found"
                  className="empty-cart-image mb-4"
                  style={{ width: "50%", height: "auto" }}
                />
              </div>
              <h1>404 Page Not Found</h1>
              <p>The page you requested does not exist.</p>
              {/* The EJS page was a dead end with no way back — a 404 should
                  always offer a route onward. */}
              <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <Link to="/" className="btn hero-shop-btn">
                  Back to Home
                </Link>
                <Link to="/shop" className="btn hero-shop-btn">
                  Continue Shopping
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
