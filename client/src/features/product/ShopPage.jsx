import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePageAssets } from "@/lib/usePageAssets";
import { userProfiles } from "@/styles/userProfiles";
import { useAuth } from "@/store/AuthContext";
import { productApi } from "./productApi";
import { cartApi } from "@/features/cart/cartApi";
import { wishlistApi } from "@/features/wishlist/wishlistApi";
import { PageError } from "@/components/layout/PageError";
import { productImageUrl } from "@/lib/imageUrl";

const PRICE_PRESETS = [
  { value: "0-1000", label: "₹0.00 - ₹1000.00" },
  { value: "1000-2000", label: "₹1000.00 - ₹2000.00" },
  { value: "2000-5000", label: "₹2000.00 - ₹5000.00" },
  { value: "5000-10000", label: "₹5000.00 - ₹10000.00" },
];

const SORT_OPTIONS = [
  { value: "", label: "Default" },
  { value: "priceLowHigh", label: "Low To High" },
  { value: "priceHighLow", label: "High To Low" },
  { value: "alphaAsc", label: "A-Z" },
  { value: "alphaDesc", label: "Z-A" },
  { value: "newArrivals", label: "New Arrivals" },
  { value: "popularity", label: "Popularity" },
];

export function ShopPage() {
  usePageAssets("user", "headershop", userProfiles);

  const [searchParams, setSearchParams] = useSearchParams();
  // Object.fromEntries collapses repeated keys (categories=A&categories=B)
  // down to just the last one — fine for reading single-value fields below,
  // but multi-select params (categories, brands) must go through
  // searchParams itself so every selected value reaches the API.
  const params = Object.fromEntries(searchParams.entries());
  const queryClient = useQueryClient();
  const { refreshMe } = useAuth();

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["shop", searchParams.toString()],
    queryFn: () => productApi.shop(searchParams),
    placeholderData: keepPreviousData,
  });

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    setSearchParams(next);
  };

  // Live search: filter as the user types instead of requiring Enter/submit,
  // debounced so we're not firing a request per keystroke. The icon button
  // and Enter key still apply immediately (skip the wait).
  // Accordion headers use data-bs-toggle="collapse" in the original markup,
  // but this profile never loads Bootstrap's JS bundle — so nothing ever
  // toggled. Drive the same .collapse/.collapse.show classes with state.
  const [openSections, setOpenSections] = useState({ categories: true, price: true, brand: true, color: true });
  const toggleSection = (key) => setOpenSections((s) => ({ ...s, [key]: !s[key] }));

  const [searchInput, setSearchInput] = useState(params.search || "");
  useEffect(() => {
    setSearchInput(params.search || "");
  }, [params.search]);
  useEffect(() => {
    if (searchInput === (params.search || "")) return;
    const timer = setTimeout(() => updateParam("search", searchInput), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // Custom min/max price, alongside the preset quick-picks — kept in the
  // same "min-max" priceRange param the backend already understands.
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  useEffect(() => {
    if (params.priceRange) {
      const [mn, mx] = params.priceRange.split("-");
      setMinPrice(mn || "");
      setMaxPrice(mx || "");
    } else {
      setMinPrice("");
      setMaxPrice("");
    }
  }, [params.priceRange]);

  const applyCustomPrice = (e) => {
    e.preventDefault();
    const mn = minPrice === "" ? 0 : Number(minPrice);
    const mx = Number(maxPrice);
    if (!maxPrice || Number.isNaN(mx) || Number.isNaN(mn) || mx <= mn) {
      toast.error("Enter a valid price range.");
      return;
    }
    updateParam("priceRange", `${mn}-${mx}`);
  };

  const hasActiveFilters = Boolean(
    params.search || params.priceRange || params.color ||
    searchParams.getAll("categories").length > 0 ||
    searchParams.getAll("brands").length > 0
  );

  const clearFilters = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("search");
    next.delete("categories");
    next.delete("brands");
    next.delete("color");
    next.delete("priceRange");
    next.delete("page");
    setSearchParams(next);
  };

  const toggleMultiParam = (key, id) => {
    const next = new URLSearchParams(searchParams);
    const current = next.getAll(key);
    next.delete(key);
    if (current.includes(id)) {
      current.filter((c) => c !== id).forEach((c) => next.append(key, c));
    } else {
      [...current, id].forEach((c) => next.append(key, c));
    }
    next.delete("page");
    setSearchParams(next);
  };

  const toggleCategory = (id) => toggleMultiParam("categories", id);
  const toggleBrand = (name) => toggleMultiParam("brands", name);
  const toggleColor = (color) => updateParam("color", params.color === color ? "" : color);

  const goToPage = (page) => {
    const next = new URLSearchParams(searchParams);
    next.set("page", page);
    setSearchParams(next);
  };

  const handleAddToCart = async (productId) => {
    try {
      const res = await cartApi.add({ productId, quantity: 1 });
      if (res?.success) {
        toast.success("Product added to cart successfully!");
        await refreshMe();
      } else {
        toast.error(res?.message || "Failed to add product to cart.");
      }
    } catch (err) {
      toast.error(err.message || "Failed to add product to cart.");
    }
  };

  const handleAddToWishlist = async (productId) => {
    try {
      const res = await wishlistApi.add(productId);
      if (res?.success) {
        toast.success("Added to wishlist");
        await refreshMe();
      } else {
        toast.error(res?.message || "Could not add to wishlist");
      }
    } catch (err) {
      toast.error(err.message || "Could not add to wishlist");
    }
  };

  const products = data?.products || [];
  const categories = data?.categories || [];
  const brands = data?.brands || [];
  const uniqueColors = (data?.uniqueColors || []).filter(Boolean);
  const currentPage = data?.currentPage || 1;
  const totalPages = data?.totalPages || 1;
  const totalProducts = data?.totalProducts || 0;
  const productsPerPage = data?.productsPerPage || 12;
  const selectedCategories = searchParams.getAll("categories");
  const selectedBrands = searchParams.getAll("brands");

  const pageNumbers = [];
  if (totalPages > 1) {
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pageNumbers.push(i);
    }
  }

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
                  <span>Shop</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container-fluid crownify4 d-flex justify-content-center align-items-center">
        <img src="/assets/images/logo/Crownify_logo_text.png" className="custom-logo" alt="" />
      </div>

      <section className="shop spad" style={{ backgroundColor: "white" }}>
        <div className="container">
          <div className="row">
            <div className="col-lg-3">
              <div className="shop__sidebar">
                <div className="shop__sidebar__search">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      updateParam("search", searchInput);
                    }}
                  >
                    <input
                      type="text"
                      id="searchInput"
                      name="search"
                      placeholder="Search..."
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                    />
                    {searchInput && (
                      <button
                        type="button"
                        aria-label="Clear search"
                        onClick={() => {
                          setSearchInput("");
                          updateParam("search", "");
                        }}
                        style={{ position: "absolute", right: 40, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", color: "#999", fontSize: 18, cursor: "pointer" }}
                      >
                        ×
                      </button>
                    )}
                    <button type="submit">
                      <span className="icon_search"></span>
                    </button>
                  </form>
                </div>

                {hasActiveFilters && (
                  <button
                    type="button"
                    className="btn"
                    onClick={clearFilters}
                    style={{ margin: "12px 0", width: "100%", backgroundColor: "#291616", color: "#fff", borderRadius: 8 }}
                  >
                    Clear All Filters
                  </button>
                )}
                <div className="shop__sidebar__accordion">
                  <div className="accordion" id="accordionExample">
                    <div className="card" style={{ background: "transparent" }}>
                      <div className="card-heading">
                        <a href="#collapseOne" onClick={(e) => { e.preventDefault(); toggleSection("categories"); }}>
                          Categories {openSections.categories ? "▾" : "▸"}
                        </a>
                      </div>
                      <div id="collapseOne" className={`collapse${openSections.categories ? " show" : ""}`}>
                        <div className="card-body">
                          <div className="shop__sidebar__categories">
                            <ul className="nice-scroll" style={{ overflowY: "auto" }}>
                              {categories.map((category) => (
                                <li key={category._id}>
                                  <label style={{ cursor: "pointer" }} onClick={() => toggleCategory(category._id)}>
                                    <input type="checkbox" readOnly checked={selectedCategories.includes(category._id)} style={{ marginRight: 6 }} />
                                    {category.name} ({category.productCount || 0})
                                  </label>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="card" style={{ background: "transparent" }}>
                      <div className="card-heading">
                        <a href="#collapseThree" onClick={(e) => { e.preventDefault(); toggleSection("price"); }}>
                          Filter Price {openSections.price ? "▾" : "▸"}
                        </a>
                      </div>
                      <div id="collapseThree" className={`collapse${openSections.price ? " show" : ""}`}>
                        <div className="card-body">
                          <div className="shop__sidebar__price">
                            <form onSubmit={applyCustomPrice} style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                              <input
                                type="number"
                                min="0"
                                placeholder="Min"
                                value={minPrice}
                                onChange={(e) => setMinPrice(e.target.value)}
                                style={{ width: "45%", padding: "6px 8px", border: "1px solid #e5e5e5" }}
                              />
                              <input
                                type="number"
                                min="0"
                                placeholder="Max"
                                value={maxPrice}
                                onChange={(e) => setMaxPrice(e.target.value)}
                                style={{ width: "45%", padding: "6px 8px", border: "1px solid #e5e5e5" }}
                              />
                              <button type="submit" className="btn" style={{ padding: "6px 10px", backgroundColor: "#291616", color: "#fff", borderRadius: 6 }}>
                                Go
                              </button>
                            </form>
                            <ul>
                              {PRICE_PRESETS.map((preset) => (
                                <li key={preset.value}>
                                  <a
                                    href="#"
                                    onClick={(e) => { e.preventDefault(); updateParam("priceRange", preset.value); }}
                                    style={params.priceRange === preset.value ? { color: "#dc0909", fontWeight: 700 } : undefined}
                                  >
                                    {preset.label}
                                  </a>
                                </li>
                              ))}
                              {params.priceRange && (
                                <li>
                                  <a href="#" onClick={(e) => { e.preventDefault(); updateParam("priceRange", ""); }} style={{ color: "#999" }}>
                                    × Clear price filter
                                  </a>
                                </li>
                              )}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>

                    {brands.length > 0 && (
                      <div className="card" style={{ background: "transparent" }}>
                        <div className="card-heading">
                          <a href="#collapseBrand" onClick={(e) => { e.preventDefault(); toggleSection("brand"); }}>
                            Brand {openSections.brand ? "▾" : "▸"}
                          </a>
                        </div>
                        <div id="collapseBrand" className={`collapse${openSections.brand ? " show" : ""}`}>
                          <div className="card-body">
                            <div className="shop__sidebar__categories">
                              <ul className="nice-scroll" style={{ overflowY: "auto" }}>
                                {brands.map((brand) => (
                                  <li key={brand._id}>
                                    <label style={{ cursor: "pointer" }} onClick={() => toggleBrand(brand.brandName)}>
                                      <input type="checkbox" readOnly checked={selectedBrands.includes(brand.brandName)} style={{ marginRight: 6 }} />
                                      {brand.brandName}
                                    </label>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {uniqueColors.length > 0 && (
                      <div className="card" style={{ background: "transparent" }}>
                        <div className="card-heading">
                          <a href="#collapseColor" onClick={(e) => { e.preventDefault(); toggleSection("color"); }}>
                            Color {openSections.color ? "▾" : "▸"}
                          </a>
                        </div>
                        <div id="collapseColor" className={`collapse${openSections.color ? " show" : ""}`}>
                          <div className="card-body">
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                              {uniqueColors.map((color) => (
                                <button
                                  type="button"
                                  key={color}
                                  title={color}
                                  onClick={() => toggleColor(color)}
                                  style={{
                                    width: 26,
                                    height: 26,
                                    borderRadius: "50%",
                                    backgroundColor: color,
                                    border: params.color === color ? "3px solid #dc0909" : "1px solid #ddd",
                                    cursor: "pointer",
                                    padding: 0,
                                  }}
                                />
                              ))}
                              {params.color && (
                                <a href="#" onClick={(e) => { e.preventDefault(); updateParam("color", ""); }} style={{ color: "#999", alignSelf: "center" }}>
                                  × Clear
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="col-lg-9">
              {isError ? (
                <PageError title="Couldn't load products" message="We couldn't reach the server. Please try again." onRetry={refetch} />
              ) : (
              <>
              <div className="shop__product__option">
                <div className="row">
                  <div className="col-lg-6 col-md-6 col-sm-6">
                    <div className="shop__product__option__left">
                      <p>
                        {isLoading
                          ? "Loading products…"
                          : totalProducts === 0
                          ? "No results"
                          : <>Showing {(currentPage - 1) * productsPerPage + 1}–{Math.min(currentPage * productsPerPage, totalProducts)} of {totalProducts} results{isFetching ? " · updating…" : ""}</>}
                      </p>
                    </div>
                  </div>
                  <div className="col-lg-6 col-md-6 col-sm-6">
                    <div className="shop__product__option__right">
                      <p>Sort by Price:</p>
                      <select value={params.sort || ""} onChange={(e) => updateParam("sort", e.target.value)}>
                        {SORT_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {isLoading ? (
                <div className="row">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div className="col-lg-4 col-md-6 col-sm-6" key={i}>
                      <div
                        style={{ borderRadius: 25, height: 340, background: "linear-gradient(90deg,#f0f0f0 25%,#f7f7f7 37%,#f0f0f0 63%)", backgroundSize: "400% 100%", animation: "shopSkeleton 1.4s ease infinite", marginBottom: 20 }}
                      />
                    </div>
                  ))}
                  <style>{"@keyframes shopSkeleton{0%{background-position:100% 50%}100%{background-position:0 50%}}"}</style>
                </div>
              ) : products.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 15px" }}>
                  <p style={{ fontSize: 16, color: "#777", marginBottom: 18 }}>No products match your filters.</p>
                  {hasActiveFilters && (
                    <button type="button" className="btn" onClick={clearFilters} style={{ backgroundColor: "#291616", color: "#fff", borderRadius: 8, padding: "10px 22px" }}>
                      Clear All Filters
                    </button>
                  )}
                </div>
              ) : (
              <div className="row" style={{ opacity: isFetching ? 0.6 : 1, transition: "opacity 0.2s ease" }}>
                {products.map((product) => {
                  const totalQuantity = product.variants ? product.variants.reduce((sum, v) => sum + v.quantity, 0) : 0;
                  return (
                    <div className="col-lg-4 col-md-6 col-sm-6" key={product._id}>
                      <div className={`product__item${product.isBlocked ? " blocked" : ""}`}>
                        <Link to={`/product/${product._id}`} className="product-click-wrapper" style={{ display: "block" }}>
                          <div className="product__item__pic" style={{ borderRadius: 25 }}>
                            <div className="image-container">
                              <img src={productImageUrl(product.productImage[0])} className="default-image" alt="Product" />
                              {product.productImage[1] && <img src={productImageUrl(product.productImage[1])} className="hover-image" alt="Hover" />}
                            </div>
                            <ul className="product__hover">
                              <li>
                                <div className="wishlist-wrapper">
                                  <a
                                    href="#"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleAddToWishlist(product._id);
                                    }}
                                  >
                                    <img src="/assets/usershop/img/icon/heart.png" alt="" style={{ backgroundColor: "transparent" }} />
                                  </a>
                                </div>
                              </li>
                            </ul>
                          </div>
                          <div className="product__item__text">
                            <h6>{product.productName}</h6>
                            <p>
                              <strong>{product.brand}</strong>
                              <br />
                              <strong>{product.category?.name}</strong>
                            </p>
                            <a
                              href="#"
                              className="add-cart"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleAddToCart(product._id);
                              }}
                            ></a>
                            <div className="rating-container">
                              <div className="rating">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <i key={i} className={`fa ${i < (product.rating || 0) ? "fa-star" : "fa-star-o"}`}></i>
                                ))}
                              </div>
                              {product.discountPercentage > 0 ? (
                                <h6 style={{ color: "red" }}>{product.discountPercentage} % off</h6>
                              ) : (
                                <h6>No Discount</h6>
                              )}
                              <div className="stock-status">
                                {totalQuantity > 10 ? (
                                  <span style={{ color: "green" }}>In stock</span>
                                ) : totalQuantity >= 1 ? (
                                  <span style={{ color: "orange" }}>{totalQuantity} left</span>
                                ) : (
                                  <span style={{ color: "red" }}>Out of stock</span>
                                )}
                              </div>
                            </div>
                            <h5>
                              ₹{product.salePrice.toFixed(2)}{" "}
                              <span style={{ paddingLeft: 10, textDecoration: "line-through", color: "rgb(179,179,179)", fontSize: "0.9em", marginRight: 8 }}>
                                ₹{product.regularPrice.toFixed(2)}
                              </span>
                            </h5>
                          </div>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
              )}

              {totalPages > 1 && !isLoading && products.length > 0 && (
                <div className="row">
                  <div className="col-lg-12">
                    <div className="product__pagination mt-3 mb-4">
                      <nav aria-label="Page navigation">
                        <ul className="pagination justify-content-center">
                          <li className={`page-item${currentPage <= 1 ? " disabled" : ""}`}>
                            <a
                              className="page-link rounded-circle"
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                if (currentPage > 1) goToPage(currentPage - 1);
                              }}
                            >
                              «
                            </a>
                          </li>
                          <li className={`page-item${currentPage === 1 ? " active" : ""}`}>
                            <a className="page-link rounded-circle" href="#" onClick={(e) => { e.preventDefault(); goToPage(1); }}>
                              01
                            </a>
                          </li>
                          {currentPage > 4 && (
                            <li className="page-item disabled">
                              <span className="page-link">...</span>
                            </li>
                          )}
                          {pageNumbers.map((i) => (
                            <li className={`page-item${i === currentPage ? " active" : ""}`} key={i}>
                              <a className="page-link rounded-circle" href="#" onClick={(e) => { e.preventDefault(); goToPage(i); }}>
                                {i.toString().padStart(2, "0")}
                              </a>
                            </li>
                          ))}
                          {currentPage < totalPages - 3 && (
                            <li className="page-item disabled">
                              <span className="page-link">...</span>
                            </li>
                          )}
                          <li className={`page-item${currentPage === totalPages ? " active" : ""}`}>
                            <a className="page-link rounded-circle" href="#" onClick={(e) => { e.preventDefault(); goToPage(totalPages); }}>
                              {totalPages.toString().padStart(2, "0")}
                            </a>
                          </li>
                          <li className={`page-item${currentPage >= totalPages ? " disabled" : ""}`}>
                            <a
                              className="page-link rounded-circle"
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                if (currentPage < totalPages) goToPage(currentPage + 1);
                              }}
                            >
                              »
                            </a>
                          </li>
                        </ul>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
              </>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
