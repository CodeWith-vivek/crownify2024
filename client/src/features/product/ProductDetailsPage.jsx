import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePageAssets } from "@/lib/usePageAssets";
import { userProfiles } from "@/styles/userProfiles";
import { useAuth } from "@/store/AuthContext";
import { productApi } from "./productApi";
import { cartApi } from "@/features/cart/cartApi";
import { wishlistApi } from "@/features/wishlist/wishlistApi";
import { MagnifierImage } from "@/components/ui/MagnifierImage";
import { productImageUrl } from "@/lib/imageUrl";

export function ProductDetailsPage() {
  usePageAssets("user", "headershopdetails", userProfiles);

  const { id } = useParams();
  const [activeImage, setActiveImage] = useState(0);
  const [size, setSize] = useState(null);
  const [color, setColor] = useState(null);
  const [adding, setAdding] = useState(false);
  const { user, refreshMe } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["product", id],
    queryFn: () => productApi.detail(id),
  });

  const product = data?.product;

  const uniqueSizes = useMemo(() => {
    if (!product) return [];
    const seen = [];
    product.variants.forEach((v) => {
      if (!seen.includes(v.size)) seen.push(v.size);
    });
    return seen;
  }, [product]);

  const colorsForSize = useMemo(() => {
    if (!product) return [];
    const scoped = product.variants.filter((v) => !size || v.size === size);
    const seenColors = new Map();
    scoped.forEach((v) => {
      if (!seenColors.has(v.color)) seenColors.set(v.color, v);
    });
    return [...seenColors.values()];
  }, [product, size]);

  const handleSizeSelect = (nextSize) => {
    setSize(nextSize);
    setColor(null);
  };

  const selectedVariant = useMemo(() => {
    if (!product || !size || !color) return null;
    return product.variants.find((v) => v.size === size && v.color === color) || null;
  }, [product, size, color]);

  const handleAddToCart = async () => {
    if (!user) {
      toast.error("Please sign in to add items to your cart");
      navigate("/login");
      return;
    }
    if (!size || !color) {
      toast.error("Please select both size and color before adding to cart.");
      return;
    }
    setAdding(true);
    try {
      const res = await cartApi.add({ productId: id, size, color, quantity: 1 });
      if (res?.success) {
        toast.success("Item added to cart successfully!");
        await refreshMe();
      } else {
        toast.error(res?.message || "Failed to add product to cart.");
      }
    } catch (err) {
      toast.error(err.message || "Failed to add product to cart.");
    } finally {
      setAdding(false);
    }
  };

  const handleAddToWishlist = async () => {
    if (!user) {
      toast.error("Please sign in to use your wishlist");
      navigate("/login");
      return;
    }
    try {
      const res = await wishlistApi.add(id);
      if (res?.success) {
        toast.success(res.message || "Added to wishlist");
        await refreshMe();
      } else {
        toast.error(res?.message || "Could not add to wishlist");
      }
    } catch (err) {
      toast.error(err.message || "Could not add to wishlist");
    }
  };

  if (isLoading) return <div className="container" style={{ padding: 60 }}>Loading...</div>;
  if (isError || !product) return <div className="container" style={{ padding: 60 }}>Product not found.</div>;

  return (
    <>
      <section className="shop-details">
        <div className="product__details__pic" style={{ backgroundColor: "#e2e0c8" }}>
          <div className="container">
            <div className="row">
              <div className="col-lg-12">
                <div className="product__details__breadcrumb">
                  <Link to="/">Home</Link>
                  <Link to="/shop">Shop</Link>
                  <span>Product Details</span>
                </div>
              </div>
            </div>
            <div className="row">
              <div className="col-lg-3 col-md-3">
                <ul className="nav nav-tabs" role="tablist">
                  {product.productImage.map((img, index) => (
                    <li className="nav-item" key={img}>
                      <a
                        className={`nav-link${activeImage === index ? " active" : ""}`}
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setActiveImage(index);
                        }}
                      >
                        <div className="product__thumb__pic set-bg" style={{ backgroundImage: `url(${productImageUrl(img)})`, borderRadius: 10 }}></div>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="col-lg-6 col-md-9">
                <div className="tab-content">
                  {product.productImage.map((img, index) => (
                    <div className={`tab-pane${activeImage === index ? " active" : ""}`} key={img} style={{ display: activeImage === index ? "block" : "none" }}>
                      <div className="product__details__pic__item img-magnifier-container">
                        <MagnifierImage
                          src={productImageUrl(img)}
                          alt={product.productName}
                          className="zoomable-image"
                          style={{ borderRadius: 14 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="product__details__content">
          <div className="container">
            <div className="row d-flex justify-content-center">
              <div className="col-lg-8">
                <div className="product__details__text">
                  <h4>{product.productName}</h4>
                  <p>
                    <strong>{product.brand}</strong>
                    <br />
                  </p>

                  <div className="rating">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <i key={i} className={`fa ${i < (product.rating || 0) ? "fa-star" : "fa-star-o"}`}></i>
                    ))}
                    <span> - {product.reviewsCount || 0} Reviews</span>
                  </div>

                  {product.discountPercentage > 0 ? (
                    <h6 style={{ color: "red" }}>
                      <b>{product.discountPercentage}% off</b>
                    </h6>
                  ) : (
                    <h6>
                      <b>NO DISCOUNT</b>
                    </h6>
                  )}
                  <h3>
                    ₹{product.salePrice.toFixed(2)}
                    <span>₹{product.regularPrice.toFixed(2)}</span>
                  </h3>
                  <p>{product.description}</p>

                  <div id="stock-display">
                    {!selectedVariant ? (
                      <span style={{ color: "gray" }}>Please select both size and color to see stock</span>
                    ) : selectedVariant.quantity > 10 ? (
                      <span style={{ color: "green" }}>In stock</span>
                    ) : selectedVariant.quantity >= 1 ? (
                      <span style={{ color: "orange" }}>{selectedVariant.quantity} left</span>
                    ) : (
                      <span style={{ color: "red" }}>Out of stock</span>
                    )}
                  </div>

                  <div className="product__details__option">
                    <div className="product__details__option">
                      <div className="product__details__option__size">
                        <span>Size:</span>
                        {uniqueSizes.map((s) => (
                          <label
                            key={s}
                            className="size-label"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              minWidth: 40,
                              padding: "6px 10px",
                              margin: "0 6px 6px 0",
                              border: size === s ? "2px solid #000" : "1px solid #ccc",
                              borderRadius: 4,
                              cursor: "pointer",
                              fontWeight: size === s ? 700 : 400,
                            }}
                          >
                            {s}
                            <input type="radio" name="size" checked={size === s} onChange={() => handleSizeSelect(s)} style={{ display: "none" }} />
                          </label>
                        ))}
                      </div>

                      <div className="product__details__option__color">
                        <span>
                          Color{color ? `: ${color}` : ""}
                        </span>
                        <div className="color-options-container" style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 6 }}>
                          {colorsForSize.map((variant) => {
                            const outOfStock = size && variant.quantity === 0;
                            const isSelected = color === variant.color;
                            const isSpecial = ["No color", "Multi"].includes(variant.color);
                            // Checkmark contrast: dark tick on light swatches, white tick on dark ones.
                            const isLightColor = ["white", "yellow", "beige", "cream", "ivory", "silver", "cornsilk", "khaki"].includes(
                              String(variant.color).toLowerCase()
                            );
                            return (
                              <label
                                className="color-label"
                                key={variant.color}
                                title={outOfStock ? `${variant.color} (out of stock)` : variant.color}
                                style={{
                                  position: "relative",
                                  display: "inline-block",
                                  boxSizing: "border-box",
                                  width: 36,
                                  height: 36,
                                  borderRadius: "50%",
                                  cursor: outOfStock ? "not-allowed" : "pointer",
                                  opacity: outOfStock ? 0.4 : 1,
                                  transition: "transform 0.15s ease",
                                  transform: isSelected ? "scale(1.08)" : "scale(1)",
                                }}
                              >
                                <input
                                  type="radio"
                                  name="color"
                                  checked={isSelected}
                                  disabled={outOfStock}
                                  onChange={() => setColor(variant.color)}
                                  style={{ display: "none" }}
                                />
                                {isSpecial ? (
                                  <span
                                    className="color-name"
                                    style={{
                                      position: "absolute",
                                      inset: 0,
                                      fontWeight: 700,
                                      fontSize: 11,
                                      boxSizing: "border-box",
                                      borderRadius: "50%",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      textAlign: "center",
                                      lineHeight: 1,
                                      background: "conic-gradient(from 0deg, #f32170, #ff6b08, #cf23cf, #eedd44, #f32170)",
                                      color: "#fff",
                                      textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                                      textDecoration: outOfStock ? "line-through" : "none",
                                    }}
                                  >
                                    {variant.color === "No color" ? "N/A" : "Multi"}
                                  </span>
                                ) : (
                                  <span
                                    className="color-swatch"
                                    style={{
                                      position: "absolute",
                                      inset: 0,
                                      boxSizing: "border-box",
                                      borderRadius: "50%",
                                      backgroundColor: variant.color,
                                      border: "1px solid rgba(0,0,0,0.15)",
                                      backgroundImage: outOfStock
                                        ? "linear-gradient(to top left, transparent calc(50% - 1px), red, transparent calc(50% + 1px))"
                                        : "none",
                                    }}
                                  ></span>
                                )}
                                {isSelected && !outOfStock && (
                                  <i
                                    className="fa fa-check"
                                    aria-hidden="true"
                                    style={{
                                      position: "absolute",
                                      top: "50%",
                                      left: "50%",
                                      transform: "translate(-50%, -50%)",
                                      fontSize: 13,
                                      color: isSpecial || !isLightColor ? "#fff" : "#000",
                                      textShadow: "0 0 2px rgba(0,0,0,0.5)",
                                      pointerEvents: "none",
                                    }}
                                  ></i>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="product__details__cart__option">
                    <span>Default Quantity : </span>
                    <div className="quantity">
                      <div className="pro-qty">
                        <input type="number" value={1} min={1} max={6} id="quantityInput" readOnly />
                      </div>
                    </div>
                    <a href="#" className="primary-btn" onClick={(e) => { e.preventDefault(); if (!adding) handleAddToCart(); }} style={{ opacity: adding ? 0.6 : 1 }}>
                      {adding ? "Adding..." : "Add to Cart"}
                    </a>
                  </div>
                  <div className="product__details__btns__option">
                    <a href="#" onClick={(e) => { e.preventDefault(); handleAddToWishlist(); }}>
                      <i className="fa fa-heart"></i> Add to Wishlist
                    </a>
                  </div>
                  <div className="product__details__last__option">
                    <h5>
                      <span>Guaranteed Safe Checkout</span>
                    </h5>
                    <img src="/assets/usershop/img/shop-details/details-payment.png" alt="" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {data?.relatedProducts?.length > 0 && (
        <section className="related spad">
          <div className="container">
            <div className="row">
              <div className="col-lg-12">
                <h3 className="related-title">Related Products</h3>
              </div>
            </div>
            <div className="row">
              {data.relatedProducts.map((p) => (
                <div className="col-lg-3 col-md-6 col-sm-6" key={p._id}>
                  <Link to={`/product/${p._id}`} className={`product__item${p.isBlocked ? " blocked" : ""}`} style={{ display: "block" }}>
                    <div className="product__item__pic set-bg" style={{ backgroundImage: `url(${productImageUrl(p.productImage[0])})` }}></div>
                    <div className="product__item__text">
                      <h6>{p.productName}</h6>
                      <div className="rating">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <i key={i} className={`fa ${i < (p.rating || 0) ? "fa-star" : "fa-star-o"}`}></i>
                        ))}
                      </div>
                      <h5>₹{p.salePrice.toFixed(2)}</h5>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
