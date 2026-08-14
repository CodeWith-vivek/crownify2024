import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePageAssets } from "@/lib/usePageAssets";
import { userProfiles } from "@/styles/userProfiles";
import { checkoutApi } from "./checkoutApi";
import { couponApi } from "@/features/coupon/couponApi";
import { addressApi } from "@/features/address/addressApi";
import { orderApi } from "@/features/order/orderApi";
import { useRazorpayScript } from "@/lib/useRazorpayScript";
import { useAuth } from "@/store/AuthContext";
import { AddressFormFields, validateAddressForm } from "@/features/address/AddressFormFields";
import { Modal } from "@/components/ui/Modal";
import { confirm } from "@/components/ui/ConfirmDialog";
import { productImageUrl } from "@/lib/imageUrl";

const emptyAddress = {
  addressType: "",
  name: "",
  country: "",
  phone: "",
  pincode: "",
  home: "",
  area: "",
  landmark: "",
  town: "",
  state: "",
};

function addressToForm(address) {
  return {
    addressType: address.addressType || "",
    name: address.fullName || "",
    country: address.country || "",
    phone: address.mobileNumber || "",
    pincode: address.postalCode || "",
    home: address.flatHouseCompany || "",
    area: address.areaStreet || "",
    landmark: address.landmark || "",
    town: address.city || "",
    state: address.state || "",
  };
}


export function CheckoutPage() {
  usePageAssets("user", "headercheckout", userProfiles);

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const razorpayReady = useRazorpayScript();
  const { refreshMe } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["checkout"],
    queryFn: checkoutApi.get,
  });

  const [paymentMethod, setPaymentMethod] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [placing, setPlacing] = useState(false);
  const [addAddressOpen, setAddAddressOpen] = useState(false);
  const [addForm, setAddForm] = useState(emptyAddress);
  const [addErrors, setAddErrors] = useState({});
  const [savingAddress, setSavingAddress] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyAddress);
  const [editErrors, setEditErrors] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [couponsOpen, setCouponsOpen] = useState(false);

  const addresses = data?.addresses || [];
  const products = data?.products || [];
  const primaryAddress = addresses.find((a) => a.isPrimary);

  const refreshCheckout = () => queryClient.invalidateQueries({ queryKey: ["checkout"] });

  const handleAddAddress = async (e) => {
    e.preventDefault();
    const nextErrors = validateAddressForm(addForm);
    setAddErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    setSavingAddress(true);
    try {
      const res = await checkoutApi.addAddress(addForm);
      if (res?.success === false) {
        toast.error(res.message || "Could not add address");
      } else {
        toast.success("Address added");
        setAddForm(emptyAddress);
        setAddErrors({});
        setAddAddressOpen(false);
        await refreshCheckout();
      }
    } catch (err) {
      toast.error(err.message || "Could not add address");
    } finally {
      setSavingAddress(false);
    }
  };

  const openEdit = (address) => {
    setEditingId(address._id);
    setEditForm(addressToForm(address));
    setEditErrors({});
  };

  const handleUpdateAddress = async (e) => {
    e.preventDefault();
    const nextErrors = validateAddressForm(editForm);
    setEditErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    setSavingEdit(true);
    try {
      const res = await addressApi.update(editingId, editForm);
      if (res?.success === false) {
        toast.error(res.message || "Could not update address");
      } else {
        toast.success("Address updated");
        setEditingId(null);
        await refreshCheckout();
      }
    } catch (err) {
      toast.error(err.message || "Could not update address");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteAddress = async (id) => {
    if (!await confirm("You won't be able to revert this action!")) return;
    try {
      await addressApi.delete(id);
      toast.success("Address removed");
      await refreshCheckout();
    } catch (err) {
      toast.error(err.message || "Could not delete address");
    }
  };

  const handleSetPrimary = async (id) => {
    if (!await confirm("Do you want to set this as your primary address?", { danger: false })) return;
    try {
      const res = await addressApi.setPrimary(id);
      if (res?.success === false) {
        toast.error(res.message || "Failed to update primary address.");
      } else {
        toast.success("Primary address updated successfully.");
        await refreshCheckout();
      }
    } catch (err) {
      toast.error("An error occurred while updating primary address. Please try again.");
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode) {
      toast.error("Please enter a coupon code.");
      return;
    }
    try {
      const res = await couponApi.apply(couponCode, data.subtotal + data.shipping);
      if (res?.success) {
        toast.success("Coupon applied successfully!");
        await refreshCheckout();
      } else {
        toast.error(res?.message || "Failed to apply coupon.");
      }
    } catch (err) {
      toast.error(err.message || "An error occurred. Try again.");
    }
  };

  const handleRemoveCoupon = async () => {
    try {
      await couponApi.remove(data.subtotal + data.shipping);
      setCouponCode("");
      toast.success("Coupon removed successfully.");
      await refreshCheckout();
    } catch (err) {
      toast.error(err.message || "Could not remove coupon");
    }
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    if (!paymentMethod) {
      toast.error("Please select a payment method (Wallet, Cash on Delivery, or Razor Pay).");
      return;
    }
    if (!primaryAddress) {
      toast.error("Please add and select a primary shipping address.");
      return;
    }
    if (paymentMethod === "COD" && data.total > 1000) {
      toast.error("Cash on Delivery is not available for orders above ₹1000. Please choose another payment method.");
      return;
    }
    if (!await confirm(`Place this order? Payment: ${paymentMethod}, Total: ₹${data.total}`)) return;

    setPlacing(true);
    try {
      const validation = await checkoutApi.validate();
      if (!validation?.success) {
        toast.error(validation?.message || "Some items are no longer available");
        await refreshCheckout();
        return;
      }

      const payload = {
        primaryAddressId: primaryAddress._id,
        subtotal: data.subtotal,
        shipping: data.shipping,
        paymentMethod,
      };
      const res = await checkoutApi.placeOrder(payload);

      if (!res?.success) {
        toast.error(res?.message || "Could not place order");
        return;
      }

      if (paymentMethod === "RazorPay") {
        if (!razorpayReady || !window.Razorpay) {
          toast.error("Payment gateway is still loading, please try again");
          return;
        }
        const rzp = new window.Razorpay({
          key: res.key,
          amount: res.amount,
          currency: "INR",
          name: "CROWNIFY",
          description: "Order Payment",
          order_id: res.razorpayOrderId,
          handler: async (response) => {
            try {
              const verifyRes = await orderApi.verifyPayment({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                orderId: res.orderId,
              });
              if (verifyRes?.success) {
                await refreshMe();
                navigate(`/payment-Success?orderId=${verifyRes.orderId}`);
              } else {
                navigate(`/payment-Failure?orderId=${res.orderId}`);
              }
            } catch {
              navigate(`/payment-Failure?orderId=${res.orderId}`);
            }
          },
          modal: {
            ondismiss: async () => {
              await orderApi.deletePreliminaryOrder(res.orderId);
              await refreshCheckout();
            },
          },
          theme: { color: "#3399cc" },
        });
        rzp.open();
      } else {
        toast.success(res.message || "Order placed successfully");
        await refreshMe();
        navigate(`/payment-Success?orderId=${res.orderId}`);
      }
    } catch (err) {
      toast.error(err.message || "Unable to process your order. Please try again.");
    } finally {
      setPlacing(false);
    }
  };

  if (isLoading) return <div className="container" style={{ padding: 60 }}>Loading...</div>;
  if (isError || !data) return <div className="container" style={{ padding: 60 }}>Your cart is empty.</div>;

  return (
    <>
      <section className="breadcrumb-option">
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              <div className="breadcrumb__text">
                <h4>Check Out</h4>
                <div className="breadcrumb__links">
                  <Link to="/">Home</Link>
                  <Link to="/shop">Shop</Link>
                  <span>Check Out</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="checkout spad">
        <div className="container">
          <form className="checkout__form" onSubmit={handlePlaceOrder}>
            <div className="row">
              <div className="col-lg-7 col-md-5">
                {addresses.length === 0 ? (
                  <h2>No address added yet.</h2>
                ) : (
                  addresses.map((address) => (
                    <div className="card mb-3 mb-lg-3" key={address._id}>
                      <div className="card-header d-flex justify-content-between align-items-center" style={{ backgroundColor: "#db1717" }}>
                        <h5 className="mb-0">Address</h5>
                        {address.isPrimary && (
                          <span className="badge bg-success" style={{ marginRight: 23, color: "white", backgroundColor: "black" }}>
                            Primary
                          </span>
                        )}
                      </div>
                      <div className="card-body">
                        <address>
                          {address.fullName}
                          <br />
                          {address.flatHouseCompany}, {address.areaStreet}
                          <br />
                          {address.city}, {address.state} - {address.postalCode}
                          <br />
                          {address.mobileNumber}
                          <br />
                        </address>
                        <div className="d-flex justify-content-between">
                          {!address.isPrimary && (
                            <a href="#" className="btn-small btn-link" onClick={(e) => { e.preventDefault(); handleSetPrimary(address._id); }}>
                              Set as Primary
                            </a>
                          )}
                          <a href="#" className="btn-small btn-link" onClick={(e) => { e.preventDefault(); openEdit(address); }}>
                            <i className="fas fa-edit"></i> Edit
                          </a>
                          <a href="#" className="btn-small btn-link text-danger" onClick={(e) => { e.preventDefault(); handleDeleteAddress(address._id); }}>
                            <i className="fas fa-trash"></i> Delete
                          </a>
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {addresses.length < 4 && (
                  <a
                    href="#"
                    className="btn btn-primary"
                    style={{ width: 150, backgroundColor: "black", marginLeft: 20, color: "rgb(251, 251, 251)" }}
                    onClick={(e) => { e.preventDefault(); setAddAddressOpen(true); }}
                  >
                    Add Address
                  </a>
                )}
              </div>

              <div className="col-lg-5 col-md-7">
                <div style={{ marginLeft: 20, paddingTop: 28, paddingBottom: 28 }}>
                  <div className="cart__discount" style={{ marginBottom: 20 }}>
                    <h6>Discount codes</h6>
                    <div className="form-stacked">
                      <input type="text" placeholder="Coupon code" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} />
                      <button
                        type="button"
                        style={{
                          fontSize: 14,
                          marginTop: 15,
                          color: "#ffffff",
                          fontWeight: 700,
                          letterSpacing: 2,
                          textTransform: "uppercase",
                          background: "#111111",
                          padding: "0 30px",
                          width: "100%",
                          border: "none",
                          height: 50,
                        }}
                        onClick={handleApplyCoupon}
                      >
                        Apply
                      </button>
                      <button
                        type="button"
                        disabled={!data.coupon}
                        style={{
                          fontSize: 14,
                          marginTop: 15,
                          color: "#ffffff",
                          fontWeight: 700,
                          letterSpacing: 2,
                          textTransform: "uppercase",
                          background: "#111111",
                          padding: "0 30px",
                          border: "none",
                          height: 50,
                          width: "100%",
                        }}
                        onClick={handleRemoveCoupon}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setCouponsOpen(true)}
                    style={{
                      marginTop: 20,
                      fontSize: 14,
                      color: "#ffffff",
                      fontWeight: 700,
                      letterSpacing: 2,
                      textTransform: "uppercase",
                      background: "#db1717",
                      padding: "0 30px",
                      border: "none",
                      borderRadius: 30,
                      height: 60,
                      width: "100%",
                    }}
                  >
                    View Coupons
                  </button>
                </div>

                <div className="checkout__order">
                  <h4 className="order__title">Your order</h4>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Quantity</th>
                        <th>Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product) => (
                        <tr key={`${product.productId}-${product.size}-${product.color}`}>
                          <td>
                            <div className="product-info" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div
                                className="product-image"
                                style={{ width: 50, height: 50, flexShrink: 0, borderRadius: 4, overflow: "hidden" }}
                              >
                                <img
                                  src={productImageUrl(product.productImage)}
                                  alt={product.productName}
                                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                                />
                              </div>
                              <div className="product-details product-details-small">
                                <p>
                                  <b>{product.productName}</b>
                                </p>
                                <p>{product.productBrand}</p>
                                <p>{product.size}</p>
                                <p>{product.color}</p>
                              </div>
                            </div>
                          </td>
                          <td>
                            <input type="text" value={product.quantity} readOnly style={{ width: 50, border: "none", background: "transparent" }} />
                          </td>
                          <td>₹{product.itemTotal}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <ul className="checkout__total__all">
                    <li>
                      {" "}
                      Sale Price Subtotal <span>₹{data.subtotal.toFixed(2)}</span>
                    </li>
                    <li>
                      Coupon Discount <span style={{ color: "green", fontSize: 14 }}>₹{data.discountAmount.toFixed(2)}</span>
                    </li>
                    <li>
                      Shipping <span style={{ color: "gray", fontSize: 14 }}>₹{data.shipping.toFixed(2)}</span>
                    </li>
                    <li>
                      Grand Total <span>₹{data.total.toFixed(2)}</span>
                    </li>
                  </ul>
                  <h4 className="order__title">Payment Method</h4>
                  <div className="checkout__input__checkbox">
                    <label htmlFor="cod-payment">
                      <input type="radio" id="cod-payment" name="paymentMethod" value="COD" checked={paymentMethod === "COD"} onChange={(e) => setPaymentMethod(e.target.value)} />
                      Cash On Delivery
                      <span className="checkmark"></span>
                    </label>
                  </div>
                  <div className="checkout__input__checkbox">
                    <label htmlFor="razorpay-payment">
                      <input
                        type="radio"
                        id="razorpay-payment"
                        name="paymentMethod"
                        value="RazorPay"
                        checked={paymentMethod === "RazorPay"}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                      />
                      Razor Pay
                      <span className="checkmark"></span>
                    </label>
                  </div>
                  <div className="checkout__input__checkbox">
                    <label htmlFor="wallet-payment">
                      <input type="radio" id="wallet-payment" name="paymentMethod" value="Wallet" checked={paymentMethod === "Wallet"} onChange={(e) => setPaymentMethod(e.target.value)} />
                      Wallet
                      <span className="checkmark"></span>
                    </label>
                  </div>
                  <button type="submit" className="site-btn" disabled={placing}>
                    {placing ? "Processing..." : "Proceed to Checkout"}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </section>

      <Modal open={addAddressOpen} onClose={() => setAddAddressOpen(false)} title="Add New Address">
        <form onSubmit={handleAddAddress} className="signup-form">
          <AddressFormFields form={addForm} setForm={setAddForm} errors={addErrors} setErrors={setAddErrors} idPrefix="add-" />
          <div className="text-center">
            <button type="submit" className="btn btn-secondary" disabled={savingAddress}>
              {savingAddress ? "Adding..." : "Add Address"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editingId} onClose={() => setEditingId(null)} title="Edit Address">
        <form onSubmit={handleUpdateAddress} className="editAddress-form">
          <AddressFormFields form={editForm} setForm={setEditForm} errors={editErrors} setErrors={setEditErrors} idPrefix="edit-" />
          <div className="col-md-12 text-center">
            <button type="submit" className="btn btn-secondary submit" disabled={savingEdit}>
              {savingEdit ? "Updating..." : "Update Address"}
            </button>
          </div>
        </form>
      </Modal>

      {couponsOpen && (
        <>
          <div className="modal fade show" style={{ display: "block" }} tabIndex="-1" role="dialog">
            <div className="modal-dialog modal-lg" role="document">
              <div className="modal-content">
                <div className="modal-header bg-primary text-white">
                  <h5 className="modal-title">
                    <i className="fas fa-tags"></i> Available Coupons
                  </h5>
                  <button type="button" className="close text-white" aria-label="Close" onClick={() => setCouponsOpen(false)}>
                    <span aria-hidden="true">&times;</span>
                  </button>
                </div>
                <div className="modal-body p-4">
                  {data.coupons && data.coupons.length > 0 ? (
                    <div className="table-responsive">
                      <table className="table table-hover align-middle">
                        <thead className="bg-light">
                          <tr>
                            <th className="text-center" style={{ width: "20%" }}>
                              Coupon Code
                            </th>
                            <th>Description</th>
                            <th className="text-center" style={{ width: "20%" }}>
                              Expiry Date
                            </th>
                            <th className="text-center" style={{ width: "20%" }}>
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.coupons.map((coupon) => (
                            <tr key={coupon._id}>
                              <td className="text-center">
                                <span className="badge badge-success" style={{ fontSize: "1rem" }}>
                                  {coupon.code}
                                </span>
                              </td>
                              <td>
                                <span className="text-success font-weight-bold">{coupon.description}</span>
                              </td>
                              <td className="text-center text-danger font-weight-bold">
                                {new Date(coupon.expiryDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                              </td>
                              <td className="text-center">
                                <button
                                  className="btn btn-primary btn-sm px-4"
                                  onClick={() => {
                                    navigator.clipboard.writeText(coupon.code);
                                    toast.success(`Coupon code copied to clipboard: ${coupon.code}`);
                                  }}
                                >
                                  Copy Code
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="alert alert-info text-center">
                      <i className="fas fa-info-circle"></i> No coupons available at the moment.
                    </div>
                  )}
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-secondary" onClick={() => setCouponsOpen(false)}>
                    <i className="fas fa-times"></i> Close
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={() => setCouponsOpen(false)}></div>
        </>
      )}
    </>
  );
}
