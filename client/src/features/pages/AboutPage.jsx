import { Link } from "react-router-dom";
import { usePageAssets } from "@/lib/usePageAssets";
import { userProfiles } from "@/styles/userProfiles";

export function AboutPage() {
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
        <h1 style={{ textAlign: "center", color: "rgb(0, 0, 0)" }}>About Us</h1>
        <div className="content" style={{ display: "flex", alignItems: "center" }}>
          <div className="logo-section" style={{ flex: 1, textAlign: "center", color: "white" }}>
            <img src="/assets/images/logoCrownify.webp" alt="Crownify Logo" style={{ width: 296, height: "auto", maxWidth: "100%", aspectRatio: "1", borderRadius: "50%", objectFit: "cover" }} />
          </div>
          <div className="col-lg-8 text-section mt-5 mb-5" style={{ flex: 2, padding: "0 20px", color: "white" }}>
            <p className="bold" style={{ fontWeight: "bold" }}>
              Welcome to Crownify, where headwear meets style and innovation.
            </p>
            <p>
              At Crownify, we believe that your choice of headwear is more than just an accessory—it's an expression of who you are. Whether you're looking for a sleek and modern look, something
              bold and futuristic, or classic styles that never go out of fashion, we've got you covered.
            </p>
            <p>
              Founded with a passion for headwear, Crownify aims to bring you the latest trends and timeless classics in one place. We handpick each piece with care to ensure top quality and
              cutting-edge designs that match your vibe.
            </p>
            <p>
              Our mission is simple: to crown your individuality. From hats, caps, beanies, and more, we provide a diverse range of headwear options for every personality, occasion, and season. And
              we're not just about style—we're committed to delivering a seamless shopping experience, with fast shipping, easy returns, and outstanding customer service.
            </p>
            <p>
              So go ahead—explore our collection and find the perfect piece to top off your look. At Crownify, it's not just about wearing a hat—it's about owning your crown.
            </p>
            <p className="bold" style={{ fontWeight: "bold" }}>
              Crownify: Your Style, Your Crown.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
