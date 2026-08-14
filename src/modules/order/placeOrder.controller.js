const Order = require("./orderSchema");
const Cart = require("../cart/cartSchema");
const Address = require("../address/addressSchema");
const Coupon = require("../coupon/couponSchema");
const User = require("../user/userSchema");
const Transaction = require("../payment/transactionSchema");
const {
  generateOrderNumber,
  recordCouponUsage,
  clearCartAfterOrder,
  buildOrderItems,
  calculateCouponDiscount,
  removeItemFromCart,
  CheckoutError,
} = require("./helpers/checkout");
const { decrementStockForItems } = require("./helpers/orderItems");
const { getRazorpay } = require("../../shared/config/razorpay");

// Checkout. Three payment paths that share everything up to the point of
// payment: validate the cart against live catalog state, resolve the
// address, price the coupon. Wallet and COD then create a completed/pending
// order outright; RazorPay creates a Pending "preliminary" order and defers
// stock and coupon side effects to payment verification (see
// payment.controller.js), because at this point the money hasn't moved yet.

const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const { primaryAddressId, subtotal, shipping, paymentMethod } = req.body;

    const removeCoupon = () => {
      if (req.session) req.session.coupon = null;
    };

    const user = await User.findById(userId);
    if (!user) {
      // NOTE: this branch (and the two below) used to call
      // removeItemFromCart(cart._id, cartItem.productId) — but `cart` is
      // declared further down with const, and `cartItem` only exists inside
      // the item loop. Both were in the temporal dead zone, so instead of
      // the intended 404/400 these paths threw
      // "ReferenceError: Cannot access 'cart' before initialization",
      // got swallowed by the outer catch, and surfaced as a generic 500.
      // There is nothing to evict from the cart here anyway — it hasn't
      // been loaded yet — so the call is simply gone.
      removeCoupon();
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (req.session.coupon && req.session.coupon.temporary) {
      const couponExists = await Coupon.findOne({ code: req.session.coupon.code });
      if (!couponExists) {
        removeCoupon();
        return res.status(400).json({
          success: false,
          message: "The applied coupon is no longer valid. Please refresh and try again.",
        });
      }
    }

    const subtotalValue = Math.floor(Number(subtotal));
    const totalBeforeDiscount = Math.floor(subtotalValue + Number(shipping));

    const cart = await Cart.findOne({ userId });
    if (!cart || cart.items.length === 0) {
      removeCoupon();
      return res.status(404).json({
        success: false,
        message: "No items in the cart to proceed",
      });
    }

    let orderProducts;
    try {
      orderProducts = await buildOrderItems(cart);
    } catch (error) {
      if (error instanceof CheckoutError) {
        if (error.productIdToRemove) {
          await removeItemFromCart(cart._id, error.productIdToRemove);
        }
        removeCoupon();
        return res.status(error.status).json({ success: false, message: error.message });
      }
      throw error;
    }

    const primaryAddress = await Address.findOne({ _id: primaryAddressId, userId });
    if (!primaryAddress) {
      return res.status(404).json({ success: false, message: "Primary address not found" });
    }

    let discount = 0;
    let appliedCoupon = null;
    let couponToApply = null;
    if (req.session.coupon && req.session.coupon.temporary) {
      const coupon = await Coupon.findOne({ code: req.session.coupon.code });

      if (!coupon) {
        return res.status(400).json({
          success: false,
          message: "The applied coupon is no longer valid. Please refresh and try again.",
        });
      }

      couponToApply = coupon;
      appliedCoupon = coupon.code;
      discount = calculateCouponDiscount(coupon, totalBeforeDiscount);
    }

    const grandTotal = Math.floor(totalBeforeDiscount - discount);

    // Fields every branch writes identically.
    const baseOrderFields = {
      userId,
      primaryAddressId,
      items: orderProducts,
      subtotal: subtotalValue,
      total: totalBeforeDiscount,
      shipping,
      discount,
      grandTotal,
      paymentMethod,
      shippingAddress: primaryAddressId,
      orderNumber: generateOrderNumber(),
    };

    if (paymentMethod === "Wallet") {
      if (user.wallet < grandTotal) {
        return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
      }

      user.wallet -= grandTotal;
      await user.save();

      const order = new Order({
        ...baseOrderFields,
        couponCode: appliedCoupon,
        paymentStatus: "Completed",
      });

      if (couponToApply) {
        order.couponDetails = {
          code: appliedCoupon,
          discountType: couponToApply.discountType,
          discountAmount: discount,
        };
        await recordCouponUsage(couponToApply, userId);
      }

      await order.save();

      await new Transaction({
        userId,
        amount: grandTotal,
        type: "debit",
        description: `Order payment for Order ID: ${order.orderNumber}`,
      }).save();

      await decrementStockForItems(cart.items);
      await clearCartAfterOrder(user, cart, req);

      return res.json({
        success: true,
        message: "Order placed successfully using wallet",
        orderId: order._id,
        orderedItems: orderProducts,
      });
    }

    if (paymentMethod === "RazorPay") {
      let razorpayOrder;
      try {
        razorpayOrder = await getRazorpay().orders.create({
          amount: Math.round(grandTotal * 100),
          currency: "INR",
          receipt: `order_${Date.now()}`,
          payment_capture: 1,
        });
      } catch (err) {
        console.error("RazorPay Order Creation Error:", err);
        return res.status(500).json({
          success: false,
          message: "Failed to create RazorPay order",
          error: err.message || err,
        });
      }

      // Deliberately does NOT decrement stock, record coupon usage or clear
      // the cart — the payment hasn't been made yet. All of that happens in
      // verifyRazorpayPayment once the signature checks out.
      const preliminaryOrder = new Order({
        ...baseOrderFields,
        couponDetails: couponToApply
          ? {
              code: appliedCoupon,
              discountType: couponToApply.discountType,
              discountAmount: discount,
            }
          : null,
        razorpayOrderId: razorpayOrder.id,
        paymentStatus: "Pending",
      });

      await preliminaryOrder.save();

      return res.json({
        success: true,
        message: "Razorpay order created",
        razorpayOrderId: razorpayOrder.id,
        amount: Math.round(grandTotal * 100),
        key: process.env.RAZORPAY_KEY_ID,
        orderId: preliminaryOrder._id,
      });
    }

    if (paymentMethod === "COD") {
      await recordCouponUsage(couponToApply, userId);

      const order = new Order({
        ...baseOrderFields,
        couponCode: appliedCoupon,
        paymentStatus: "Pending",
      });

      await order.save();

      await decrementStockForItems(cart.items);
      await clearCartAfterOrder(user, cart, req);

      return res.json({
        success: true,
        message: "Order placed successfully with Cash on Delivery",
        orderId: order._id,
        orderedItems: orderProducts,
      });
    }

    // Previously fell through and returned nothing at all, leaving the
    // request hanging until it timed out.
    return res.status(400).json({
      success: false,
      message: `Unsupported payment method: ${paymentMethod}`,
    });
  } catch (error) {
    console.error("Error placing order:", error);
    return res.status(500).json({
      success: false,
      message: "Error placing order",
      error: error.message || error,
    });
  }
};

const deletepremilinaryOrder = async (req, res) => {
  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({
      success: false,
      message: "Order ID is required for deletion",
    });
  }

  try {
    const order = await Order.findOne({ _id: orderId, userId: req.session.user });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.paymentStatus !== "Pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending orders can be deleted",
      });
    }

    await Order.findByIdAndDelete(orderId);

    return res.json({
      success: true,
      message: "Preliminary order deleted successfully",
    });
  } catch (err) {
    console.error("DEBUG: Error deleting preliminary order:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to delete preliminary order",
      error: err.message,
    });
  }
};

module.exports = { placeOrder, deletepremilinaryOrder };
