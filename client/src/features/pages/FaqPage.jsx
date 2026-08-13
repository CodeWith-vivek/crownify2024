import { Link } from "react-router-dom";
import { usePageAssets } from "@/lib/usePageAssets";
import { userProfiles } from "@/styles/userProfiles";

export function FaqPage() {
  usePageAssets("user", "headerAbout", userProfiles);

  return (
    <>
      <section className="breadcrumb-option">
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              <div className="breadcrumb__text">
                <h4>Shop</h4>
                <div className="breadcrumb__links">
                  <Link to="/">Home</Link>
                  <span>About</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <div className="about-section" style={{ backgroundColor: "rgb(144 120 103)", padding: 20 }}>
        <h1 style={{ textAlign: "center", color: "rgb(0, 0, 0)" }}>Crownify Frequently Asked Questions (FAQ)</h1>
        <div className="content" style={{ display: "flex", alignItems: "center" }}>
          <div className="logo-section" style={{ flex: 1, textAlign: "center", color: "white" }}>
            <img src="/assets/images/logoCrownify.png" alt="Crownify Logo" style={{ width: 296, height: "auto", maxWidth: "100%", aspectRatio: "1", borderRadius: "50%", objectFit: "cover" }} />
          </div>
          <div className="col-lg-8 text-section mt-5 mb-5" style={{ flex: 2, padding: "0 20px", color: "white" }}>
            <p className="bold" style={{ fontWeight: "bold" }}>
              1. What types of headwear do you sell?
            </p>
            <p>
              At Crownify, we specialize in all types of headwear, including hats, caps, and beanies. Our collection features both trendy and classic designs to suit every style and occasion.
            </p>
            <p className="bold" style={{ fontWeight: "bold" }}>
              2. Do you offer customized or personalized headwear?
            </p>
            <p>
              Yes! We offer customized headwear for certain products. You can add your initials, logos, or designs to select items. Please note that customized products are non-returnable.
            </p>
            <p className="bold" style={{ fontWeight: "bold" }}>
              3. What are the payment options available?
            </p>
            <p>
              We accept multiple payment methods, including:
              <br />
              * COD
              <br />
              * Wallet
              <br />
              * RazorPay
            </p>
            <p>So go ahead—explore our collection and find the perfect piece to top off your look. At Crownify, it's not just about wearing a hat—it's about owning your crown.</p>
            <p className="bold" style={{ fontWeight: "bold" }}>
              Crownify: Your Style, Your Crown.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
