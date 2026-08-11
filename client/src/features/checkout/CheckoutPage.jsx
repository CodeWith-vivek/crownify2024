import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { checkoutApi } from "./checkoutApi";
import { couponApi } from "@/features/coupon/couponApi";
import { orderApi } from "@/features/order/orderApi";
import { useRazorpayScript } from "@/lib/useRazorpayScript";
import { useAuth } from "@/store/AuthContext";

const emptyAddress = {
  addressType: "Home",
  name: "",
  country: "India",
  phone: "",
  pincode: "",
  home: "",
  area: "",
  landmark: "",
  town: "",
  state: "",
};

export function CheckoutPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const razorpayReady = useRazorpayScript();
  const { refreshMe } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["checkout"],
    queryFn: checkoutApi.get,
  });

  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [couponCode, setCouponCode] = useState("");
  const [placing, setPlacing] = useState(false);
  const [addressForm, setAddressForm] = useState(emptyAddress);
  const [savingAddress, setSavingAddress] = useState(false);

  const addresses = data?.addresses || [];
  const primaryAddressId = selectedAddressId || addresses.find((a) => a.isPrimary)?._id || addresses[0]?._id;

  const refreshCheckout = () => queryClient.invalidateQueries({ queryKey: ["checkout"] });

  const handleAddAddress = async (e) => {
    e.preventDefault();
    setSavingAddress(true);
    try {
      await checkoutApi.addAddress(addressForm);
      toast.success("Address added");
      setAddressForm(emptyAddress);
      await refreshCheckout();
    } catch (err) {
      toast.error(err.message || "Could not add address");
    } finally {
      setSavingAddress(false);
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode) return;
    try {
      const res = await couponApi.apply(couponCode, data.subtotal);
      if (res?.success) {
        toast.success("Coupon applied");
        await refreshCheckout();
      } else {
        toast.error(res?.message || "Invalid coupon");
      }
    } catch (err) {
      toast.error(err.message || "Invalid coupon");
    }
  };

  const handleRemoveCoupon = async () => {
    try {
      await couponApi.remove(data.subtotal);
      setCouponCode("");
      await refreshCheckout();
    } catch (err) {
      toast.error(err.message || "Could not remove coupon");
    }
  };

  const handlePlaceOrder = async () => {
    if (!primaryAddressId) {
      toast.error("Please select or add a shipping address");
      return;
    }
    setPlacing(true);
    try {
      const validation = await checkoutApi.validate();
      if (!validation?.success) {
        toast.error(validation?.message || "Some items are no longer available");
        await refreshCheckout();
        return;
      }

      const payload = {
        primaryAddressId,
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
              toast.info("Payment cancelled");
            },
          },
          theme: { color: "#291616" },
        });
        rzp.open();
      } else {
        toast.success(res.message || "Order placed successfully");
        await refreshMe();
        navigate(`/payment-Success?orderId=${res.orderId}`);
      }
    } catch (err) {
      toast.error(err.message || "Could not place order");
    } finally {
      setPlacing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-muted-foreground">
        Could not load checkout. Your cart may be empty.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-heading text-3xl font-bold text-primary">Checkout</h1>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Shipping Address</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {addresses.map((addr) => (
                <label
                  key={addr._id}
                  className={`block cursor-pointer rounded-md border p-3 text-sm ${
                    primaryAddressId === addr._id ? "border-primary ring-1 ring-primary" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="address"
                    className="mr-2"
                    checked={primaryAddressId === addr._id}
                    onChange={() => setSelectedAddressId(addr._id)}
                  />
                  <span className="font-medium">{addr.fullName}</span> — {addr.flatHouseCompany}, {addr.areaStreet},{" "}
                  {addr.city}, {addr.state} - {addr.postalCode} ({addr.mobileNumber})
                </label>
              ))}

              {addresses.length === 0 && (
                <p className="text-sm text-muted-foreground">No saved addresses. Add one below.</p>
              )}

              <details className="pt-2">
                <summary className="cursor-pointer text-sm font-medium text-accent">
                  {addresses.length === 0 ? "Add a shipping address" : "Add another address"}
                </summary>
                <form onSubmit={handleAddAddress} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input placeholder="Full name" required value={addressForm.name} onChange={(e) => setAddressForm({ ...addressForm, name: e.target.value })} />
                  <Input placeholder="Phone" required value={addressForm.phone} onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })} />
                  <Input placeholder="Flat / House / Company" required value={addressForm.home} onChange={(e) => setAddressForm({ ...addressForm, home: e.target.value })} />
                  <Input placeholder="Area / Street" required value={addressForm.area} onChange={(e) => setAddressForm({ ...addressForm, area: e.target.value })} />
                  <Input placeholder="Landmark" value={addressForm.landmark} onChange={(e) => setAddressForm({ ...addressForm, landmark: e.target.value })} />
                  <Input placeholder="Town / City" required value={addressForm.town} onChange={(e) => setAddressForm({ ...addressForm, town: e.target.value })} />
                  <Input placeholder="State" required value={addressForm.state} onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })} />
                  <Input placeholder="Pincode" required value={addressForm.pincode} onChange={(e) => setAddressForm({ ...addressForm, pincode: e.target.value })} />
                  <Button type="submit" disabled={savingAddress} className="sm:col-span-2">
                    {savingAddress ? "Saving..." : "Save Address"}
                  </Button>
                </form>
              </details>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment Method</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {["COD", "Wallet", "RazorPay"].map((method) => (
                <label key={method} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={paymentMethod === method}
                    onChange={() => setPaymentMethod(method)}
                  />
                  {method === "COD" ? "Cash on Delivery" : method === "Wallet" ? "Wallet" : "Razorpay (Card/UPI/Netbanking)"}
                </label>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="h-fit space-y-4 rounded-lg border p-6">
          <h2 className="font-heading text-lg font-semibold text-primary">Order Summary</h2>

          <div className="space-y-1">
            {data.products.map((p) => (
              <div key={`${p.productId}-${p.size}-${p.color}`} className="flex justify-between text-sm">
                <span className="truncate">{p.productName} x{p.quantity}</span>
                <span>₹{p.itemTotal}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Input placeholder="Coupon code" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} />
            {data.coupon ? (
              <Button variant="outline" onClick={handleRemoveCoupon}>Remove</Button>
            ) : (
              <Button variant="outline" onClick={handleApplyCoupon}>Apply</Button>
            )}
          </div>

          <div className="space-y-2 border-t pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>₹{data.subtotal}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span>₹{data.shipping}</span>
            </div>
            {data.discountAmount > 0 && (
              <div className="flex justify-between text-accent">
                <span>Discount</span>
                <span>-₹{data.discountAmount}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Total</span>
              <span>₹{data.total}</span>
            </div>
          </div>

          <Button className="w-full" disabled={placing} onClick={handlePlaceOrder}>
            {placing ? "Placing order..." : "Place Order"}
          </Button>
        </div>
      </div>
    </div>
  );
}
