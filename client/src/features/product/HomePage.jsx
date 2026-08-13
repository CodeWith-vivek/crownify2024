import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { usePageAssets } from "@/lib/usePageAssets";
import { userProfiles } from "@/styles/userProfiles";
import { productApi } from "./productApi";
import { Carousel } from "@/components/ui/Carousel";
import { Marquee } from "@/components/ui/Marquee";
import { PageError } from "@/components/layout/PageError";
import { productImageUrl } from "@/lib/imageUrl";

const PRODUCT_SLIDER_BASE = 4;
const PRODUCT_SLIDER_BREAKPOINTS = [
  { maxWidth: 1024, count: 3 },
  { maxWidth: 600, count: 2 },
  { maxWidth: 480, count: 1 },
];

const TOP_BRAND_LOGOS = [
  "/assets/images/logo/puma7.png",
  "/assets/images/logo/Urbanmonkey1.png",
  "/assets/images/logo/nike2.png",
  "/assets/images/logo/Adidas.png",
];

const HERO_SLIDES = [
  {
    src: "/assets/images/slideshow-banners/hero14.jpg",
    alt: "Outfit of Today",
    title: "Caps of Today",
    subtitle: "Trending in 2025",
  },
  {
    src: "/assets/images/slideshow-banners/img19.jpg",
    alt: "Accessories",
    title: "Collections",
    subtitle: "New Collection ",
  },
];

function HeroSlideshow() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActive((i) => (i + 1) % HERO_SLIDES.length);
    }, 7000);
    return () => clearInterval(timer);
  }, []);

  const goTo = (i) => setActive((i + HERO_SLIDES.length) % HERO_SLIDES.length);

  return (
    <div className="home-slideshow" style={{ position: "relative" }}>
      {HERO_SLIDES.map((slide, i) => (
        <div
          className="slide slideshow--medium"
          key={slide.src}
          style={{
            position: i === active ? "relative" : "absolute",
            top: 0,
            left: 0,
            width: "100%",
            opacity: i === active ? 1 : 0,
            visibility: i === active ? "visible" : "hidden",
            transition: "opacity 600ms ease",
          }}
        >
          <div className="blur-up lazyload">
            <img src={slide.src} alt={slide.alt} title={slide.alt} onLoad={(e) => e.currentTarget.parentElement.classList.add("lazyloaded")} />
            <div className="slideshow__text-wrap slideshow__overlay classic middle">
              <div className="slideshow__text-content classic left">
                <div className="container">
                  <div className="wrap-caption left">
                    <h2 className="h1 mega-title slideshow__title">{slide.title}</h2>
                    <span className="mega-subtitle slideshow__subtitle">{slide.subtitle}</span>
                    <Link to="/shop">
                      <span className="btn hero-shop-btn">SHOP NOW</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
      <button
        type="button"
        aria-label="Previous slide"
        onClick={() => goTo(active - 1)}
        style={{ position: "absolute", top: "50%", left: 20, transform: "translateY(-50%)", zIndex: 10, background: "none", border: "none", fontSize: 32, color: "#fff", cursor: "pointer" }}
      >
        ‹
      </button>
      <button
        type="button"
        aria-label="Next slide"
        onClick={() => goTo(active + 1)}
        style={{ position: "absolute", top: "50%", right: 20, transform: "translateY(-50%)", zIndex: 10, background: "none", border: "none", fontSize: 32, color: "#fff", cursor: "pointer" }}
      >
        ›
      </button>
    </div>
  );
}

export function HomePage() {
  usePageAssets("user", "header", userProfiles);

  const { data, isError, refetch } = useQuery({
    queryKey: ["home"],
    queryFn: productApi.home,
  });

  const products = data?.products || [];

  if (isError) return <PageError onRetry={refetch} />;

  return (
    <div id="page-content">
      <div className="slideshow slideshow-wrapper pb-section">
        <HeroSlideshow />
      </div>

      <div className="container-fluid crownify2 d-flex justify-content-center align-items-center">
        <img src="/assets/images/logo/Crownify_logo_text.png" className="custom-logo" alt="" />
      </div>

      <div className="section feature-content" style={{ backgroundColor: "antiquewhite" }}>
        <div className="container">
          <div className="row">
            <div className="feature-row">
              <div className="col-12 col-sm-12 col-md-6 feature-row__item text-center">
                <img src="/assets/images/collection/nikecap.jpg" alt="Hot hoodies jackets" title="Hot hoodies jackets" style={{ marginTop: 20, borderRadius: 5 }} />
              </div>
              <div className="col-12 col-sm-12 col-md-6 feature-row__item feature-row__text feature-row__text--left text-left">
                <div className="row-text" style={{ paddingTop: 15, paddingLeft: 15, borderRadius: 7, backgroundColor: "#ff00309c" }}>
                  <h2 className="h2">Shop From Top Brand</h2>
                  <p>Cover all your style in caps</p>
                  <Link to="/brand" className="btn">
                    SHOP NOW
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="section feature-content" style={{ backgroundColor: "antiquewhite" }}>
        <div className="container">
          <div className="row">
            <div className="feature-row">
              <div className="col-12 col-sm-12 col-md-6 feature-row__item feature-row__text feature-row__text--right text-right">
                <div className="row-text" style={{ paddingTop: 15, paddingRight: 15, borderRadius: 7, backgroundColor: "#a84b069c" }}>
                  <h2 className="h2">Shop By category</h2>
                  <p> Caps &amp; Hats are waiting for you !</p>
                  <Link to="/shop" className="btn">
                    SHOP NOW
                  </Link>
                </div>
              </div>
              <div className="col-12 col-sm-12 col-md-6 feature-row__item text-center">
                <img src="/assets/images/collection/cap4.jpg" alt="Shoes Collection" title="Shoes Collection" style={{ marginTop: 20 }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container-fluid crownify d-flex justify-content-center align-items-center" style={{ marginTop: 0 }}>
        <img src="/assets/images/logo/Crownify_logo_text.png" className="custom-logo" alt="" />
      </div>

      <div
        className="section hero hero--medium hero__overlay bg-size"
        style={{ backgroundImage: "url(/assets/images/parallax-banners/banner2.jpg)", backgroundPosition: "50% 20%", height: 600 }}
      >
        <div className="hero__inner">
          <div className="container">
            <div className="wrap-text right text-medium font-bold">
              <h2 className="h2 mega-title">BUY PERSONAL CAP</h2>
              <div className="rte-setting mega-subtitle" style={{ lineHeight: "40px" }}>
                Make your cap dream even more meaningful by <br />
                purchasing it from top brand.
              </div>
              <Link to="/shop" className="btn hero-shop-btn">
                SHOP NOW
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container-fluid crownify4 d-flex justify-content-center align-items-center">
        <img src="/assets/images/logo/Crownify_logo_text.png" className="custom-logo" alt="" />
      </div>

      <div className="section" style={{ backgroundColor: "#ed143d" }}>
        <div className="container">
          <div className="row">
            <div className="col-12 col-sm-12 col-md-12 col-lg-12 mb-3">
              <div className="section-header text-center">
                <h2 className="h2">Shop these Caps</h2>
                <p>Shop from collections for a caps &amp; hats.</p>
              </div>
              <Carousel
                className="productSlider grid-products grid-products-hover-gry"
                items={products}
                itemKey={(product) => product._id}
                base={PRODUCT_SLIDER_BASE}
                breakpoints={PRODUCT_SLIDER_BREAKPOINTS}
                renderItem={(product) => (
                  <div className="item">
                    <div className="product-image">
                      <Link to={`/product/${product._id}`} className="grid-view-item__link">
                        <img
                          className="primary blur-up lazyload"
                          src={productImageUrl(product.productImage[0])}
                          alt={product.productName}
                          title={product.productName}
                          style={{ borderRadius: 14 }}
                          onLoad={(e) => e.currentTarget.classList.add("lazyloaded")}
                        />
                        {product.productImage[1] && (
                          <img
                            className="hover blur-up lazyload"
                            src={productImageUrl(product.productImage[1])}
                            alt={product.productName}
                            title={product.productName}
                            style={{ borderRadius: 14 }}
                            onLoad={(e) => e.currentTarget.classList.add("lazyloaded")}
                          />
                        )}
                      </Link>
                    </div>
                    <div className="product-details text-center">
                      <div className="product-name">
                        <Link to={`/product/${product._id}`}>{product.productName}</Link>
                      </div>
                      <h5>
                        <span style={{ paddingLeft: 10, textDecoration: "line-through", color: "rgb(179,179,179)", fontSize: "0.9em", marginRight: 8 }}>
                          ₹{product.regularPrice.toFixed(2)}
                        </span>
                      </h5>
                      <div className="product-price">
                        <span className="price">₹{product.salePrice.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="container-fluid crownify4 d-flex justify-content-center align-items-center">
        <img src="/assets/images/logo/Crownify_logo_text.png" className="custom-logo" alt="" />
      </div>

      <div className="section feature-content" style={{ backgroundColor: "black" }}>
        <div className="container">
          <div className="row">
            <div className="feature-row">
              <div className="col-12 col-sm-12 col-md-6 feature-row__item text-center">
                <img src="/assets/images/collection/post1.jpg" alt="Nuke New Arrivals" title="Nuke New Arrivals" style={{ marginTop: 15 }} />
              </div>
              <div className="col-12 col-sm-12 col-md-6 feature-row__item feature-row__text feature-row__text--left text-left">
                <div className="row-text" style={{ borderRadius: 21, backgroundColor: "#ccccccab", paddingLeft: 15, paddingTop: 15 }}>
                  <h2 className="h2">Nuke New Arrivals</h2>
                  <p>Fresh arrivals are here to take over your closet!</p>
                  <Link to="/shop" className="btn">
                    Explore Now
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container-fluid crownify4 d-flex justify-content-center align-items-center">
        <img src="/assets/images/logo/Crownify_logo_text.png" className="custom-logo" alt="" />
      </div>

      <div className="section logo-section">
        <div className="container-secondary">
          <div className="row">
            <div className="col-12 col-sm-12 col-md-12 col-lg-12">
              <div className="section-header text-center">
                <h2 className="h2">Top Brands</h2>
              </div>
              <Marquee
                className="logo-bar"
                items={TOP_BRAND_LOGOS}
                itemKey={(src) => src}
                speedSeconds={18}
                renderItem={(src) => (
                  <div className="logo-bar__item" style={{ padding: "0 30px", display: "flex", alignItems: "center" }}>
                    <img src={src} alt="" style={{ height: 100, width: "auto" }} />
                  </div>
                )}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
