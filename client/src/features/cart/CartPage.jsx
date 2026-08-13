import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { usePageAssets } from "@/lib/usePageAssets";
import { userProfiles } from "@/styles/userProfiles";
import { useAuth } from "@/store/AuthContext";
import { PageError } from "@/components/layout/PageError";
import { cartApi } from "./cartApi";

function stockColor(stock) {
  if (stock === 0) return "rgb(237, 50, 50)";
  if (stock > 0 && stock <= 10) return "rgb(255, 165, 0)";
  return "rgb(32, 167, 32)";
}

function stockLabel(stock) {
  if (stock === 0) return "Out of Stock";
  if (stock > 0 && stock <= 10) return `${stock} left`;
  return "In Stock";
}

export function CartPage() {
  usePageAssets("user", "headercart", userProfiles);

  const queryClient = useQueryClient();
  const { user, refreshMe } = useAuth();

  const { data, isError, refetch } = useQuery({
    queryKey: ["cart"],
    queryFn: cartApi.get,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["cart"] });
    await refreshMe();
  };

  const handleQuantityChange = async (item, delta) => {
    const nextQuantity = item.quantity + delta;
    if (nextQuantity < 1 || nextQuantity > 6) return;
    if (delta > 0 && nextQuantity > item.selectedVariantStockLevel) return;
    try {
      const res = await cartApi.update({
        productId: item.product._id,
        size: item.size,
        color: item.color,
        quantity: nextQuantity,
      });
      if (res?.success) {
        await refresh();
      } else {
        toast.error(res?.message || "Could not update quantity");
      }
    } catch (err) {
      toast.error(err.message || "Could not update quantity");
    }
  };

  const handleRemove = async (item) => {
    try {
      const res = await cartApi.remove({
        productId: item.product._id,
        size: item.size,
        color: item.color,
      });
      if (res?.success) {
        toast.success("Item removed");
        await refresh();
      } else {
        toast.error(res?.message || "Could not remove item");
      }
    } catch (err) {
      toast.error(err.message || "Could not remove item");
    }
  };

  const isCartEmpty = data?.isCartEmpty ?? true;
  const isGuest = !user;
  const cartItems = data?.cartItems || [];

  // Distinguish a failed request from a genuinely empty cart — otherwise a
  // network error reads as "Your Cart is Empty".
  if (isError) {
    return <PageError title="Couldn't load your cart" message="We couldn't reach the server to load your cart. Your items are safe — please try again." onRetry={refetch} />;
  }

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
                  <span>Shop</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="shopping-cart spad" style={{ marginLeft: 50, marginRight: 50 }}>
        <div className="container-fluid">
          <div className="row justify-content-center">
            <div className="col-lg-9" style={{ paddingTop: 28, marginLeft: 35, marginRight: 12 }}>
              {isCartEmpty ? (
                <div className="empty-cart-section">
                  <div className="empty-cart-content">
                    <img src="/assets/images/Empty_Cart.png" alt="Empty Cart" className="empty-cart-image mb-4" />
                    <h2>Your Cart is Empty</h2>
                    {!isGuest ? (
                      <p>Looks like you haven't added any items to your cart yet.</p>
                    ) : (
                      <p>Looks like you not logged in yet. You need to login to have access to cart or to purchase item .</p>
                    )}
                    <div className="empty-cart-actions">
                      <Link to="/" className="btn btn-primary" style={{ backgroundColor: "black" }}>
                        Continue Shopping
                      </Link>
                      {!isGuest && (
                        <Link to="/wishlist" className="btn btn-secondary">
                          View Wishlist
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="shopping__cart__table">
                    <table className="table table-responsive cart-table">
                      <thead>
                        <tr>
                          <th style={{ width: 200 }}>Product</th>
                          <th>Brand</th>
                          <th>size</th>
                          <th>Color</th>
                          <th>Category</th>
                          <th>Quantity</th>
                          <th>Status</th>
                          <th>Subtotal</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cartItems.map((item) => (
                          <tr className="cart-item" key={`${item.product._id}-${item.size}-${item.color}`}>
                            <td className="product-details d-flex col">
                              <img
                                src={item.productImage ? `/uploads/product-image/${item.productImage}` : "/path/to/default-image.jpg"}
                                alt={item.productName}
                                className="img-fluid"
                                style={{ paddingRight: 4, maxWidth: "49%", height: 38 }}
                              />
                              <div className="product-info">
                                <h6>{item.productName}</h6>
                                <p>
                                  Sale Price: <b>{item.product.salePrice}</b>
                                </p>
                              </div>
                            </td>
                            <td className="product-color">
                              <p>{item.productBrand}</p>
                            </td>
                            <td className="product-color">
                              <p>{item.size}</p>
                            </td>
                            <td className="product-color">
                              <p>{item.color}</p>
                            </td>
                            <td className="product-color">
                              <p>{item.productCategory}</p>
                            </td>
                            <td className="product-quantity">
                              <div className="quantity-control d-flex col">
                                <button className="qty-btn decrease-qty" style={{ border: "none" }} onClick={() => handleQuantityChange(item, -1)}>
                                  -
                                </button>
                                <input style={{ width: 48, border: "none" }} type="number" value={item.quantity} readOnly min={1} max={6} className="quantity-input" />
                                <button className="qty-btn increase-qty" style={{ border: "none" }} onClick={() => handleQuantityChange(item, 1)}>
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="product-status">
                              <p className="stock-status" style={{ color: stockColor(item.selectedVariantStockLevel) }}>
                                {stockLabel(item.selectedVariantStockLevel)}
                              </p>
                            </td>
                            <td className="product-total">₹{item.itemTotal.toFixed(2)}</td>
                            <td className="cart__close" onClick={() => handleRemove(item)}>
                              <i className="fa fa-close"></i>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="row">
                    <div className="col-lg-6 col-md-6 col-sm-6">
                      <div className="continue__btn" style={{ marginLeft: 35 }}>
                        <Link to="/shop">Continue Shopping</Link>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {!isCartEmpty && (
              <div className="cart-summary" style={{ backgroundColor: "#f3efe9", padding: "20px 20px 20px 20px", marginTop: 30 }}>
                <div className="summary-card">
                  <h6 className="text-center">
                    <b>CART TOTAL</b>
                  </h6>
                  <ul className="list-unstyled col-12">
                    <li className="summary-row d-flex justify-content-between">
                      <span style={{ width: 100 }}>Sale Price Subtotal</span>
                      <span style={{ color: "#f94242", marginTop: 15 }}>
                        <b>₹{data.subtotal.toFixed(2)}</b>
                      </span>
                    </li>
                    <li className="summary-row d-flex justify-content-between">
                      <span>Shipping</span>
                      <span>₹{data.shippingCharge.toFixed(2)}</span>
                    </li>
                    <li className="summary-row total d-flex justify-content-between">
                      <span>Total</span>
                      <strong style={{ color: "#f94242" }}>₹{data.total.toFixed(2)}</strong>
                    </li>
                  </ul>
                  <Link to="/checkout" className="btn btn-primary w-100" style={{ borderRadius: 0, backgroundColor: "black" }}>
                    Proceed to Checkout
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
