import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { usePageAssets } from "@/lib/usePageAssets";
import { userProfiles } from "@/styles/userProfiles";
import { productApi } from "@/features/product/productApi";
import { Carousel } from "@/components/ui/Carousel";
import { PageError } from "@/components/layout/PageError";
import { productImageUrl } from "@/lib/imageUrl";

const PRODUCT_SLIDER_BASE = 4;
const PRODUCT_SLIDER_BREAKPOINTS = [
  { maxWidth: 1024, count: 3 },
  { maxWidth: 600, count: 2 },
  { maxWidth: 480, count: 1 },
];

// The original Brand page hardcoded exactly these four brand sections with
// a filter bug (product.category && !product.category.isListed — inverted,
// so it only ever matches unlisted categories) — replicated as-is to match
// current behavior exactly, not "fixed", since that's what's live today.
const BRAND_SECTIONS = [
  { name: "URBAN MONKEY", banner: "/assets/images/urbanWhite.webp" },
  { name: "ADDIDAS", banner: "/assets/images/addidasWhite.webp" },
  { name: "NIKE", banner: "/assets/images/nikeWhite.webp" },
  { name: "PUMA", banner: "/assets/images/pumaWhite.webp" },
];

function filterForBrand(products, brandName) {
  return products.filter(
    (product) =>
      product.brand === brandName &&
      !product.isBlocked &&
      product.category &&
      !product.category.isListed &&
      product.brand &&
      !product.brand.isBlocked
  );
}

function ProductRow({ product }) {
  const totalQuantity = product.variants ? product.variants.reduce((sum, v) => sum + v.quantity, 0) : 0;
  return (
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
          <span style={{ paddingLeft: 10, textDecoration: "line-through", color: "rgb(179,179,179)", fontSize: "0.9em", marginRight: 8 }}>₹{product.regularPrice.toFixed(2)}</span>
        </h5>
        <div className="product-price">
          <span className="price">₹{product.salePrice.toFixed(2)}</span>
        </div>
        <div className="rating-container">
          <div className="stock-status">
            {totalQuantity > 10 ? <span style={{ color: "green" }}>In stock</span> : totalQuantity >= 1 ? <span style={{ color: "orange" }}>{totalQuantity} left</span> : <span style={{ color: "red" }}>Out of stock</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function BrandPage() {
  usePageAssets("user", "header", userProfiles);

  const { data, isError, refetch } = useQuery({
    queryKey: ["brand"],
    queryFn: productApi.brand,
  });

  const products = data?.products || [];

  if (isError) return <PageError onRetry={refetch} />;

  return (
    <>
      <section className="breadcrumb-option">
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              <div className="breadcrumb__text">
                <h4 style={{ fontSize: 24, fontFamily: "'Nunito Sans'" }}>Shop</h4>
                <div className="breadcrumb__links">
                  <Link to="/">Home</Link>
                  <span>&gt;</span>
                  <span>Brand</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <div className="container-fluid crownify d-flex justify-content-center align-items-center" style={{ marginTop: 0 }}>
        <img src="/assets/images/logo/Crownify_logo_text.webp" className="custom-logo" alt="" />
      </div>

      <div id="page-content">
        <div className="slideshow slideshow-wrapper pb-section">
          <div className="home-slideshow">
            <div className="slide slideshow--medium">
              <div className="blur-up lazyload">
                <img
                  src="/assets/images/brand.webp"
                  alt="Outfit of Today"
                  title="Outfit of Today"
                  onLoad={(e) => e.currentTarget.parentElement.classList.add("lazyloaded")}
                />
              </div>
            </div>
          </div>
        </div>

        {BRAND_SECTIONS.map((section) => (
          <div key={section.name}>
            <div className="container-fluid crownify2 d-flex justify-content-around align-items-center">
              <img src="/assets/images/logo/Crownify_logo_text.webp" className="custom-logo" alt="" />
              <img src={section.banner} className="custom-logo" alt="" style={{ maxHeight: "90%", width: "auto", height: "auto", objectFit: "contain" }} />
              <img src="/assets/images/logo/Crownify_logo_text.webp" className="custom-logo" alt="" />
            </div>

            <div className="section" style={{ backgroundColor: "white" }}>
              <div className="container">
                <div className="row">
                  <div className="col-12 col-sm-12 col-md-12 col-lg-12 mb-3">
                    <Carousel
                      className="productSlider grid-products grid-products-hover-gry"
                      items={filterForBrand(products, section.name)}
                      itemKey={(product) => product._id}
                      base={PRODUCT_SLIDER_BASE}
                      breakpoints={PRODUCT_SLIDER_BREAKPOINTS}
                      renderItem={(product) => <ProductRow product={product} />}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
