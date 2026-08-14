const crypto = require("crypto");
const Order = require("./orderSchema");
const Cart = require("../cart/cartSchema");
const Coupon = require("../coupon/couponSchema");
const User = require("../user/userSchema");
const { notFound, badRequest } = require("../../shared/errors/AppError");
const { recordCouponUsage, clearCartAfterOrder } = require("./helpers/checkout");
const { decrementStockForItems } = require("./helpers/orderItems");

// RazorPay verification, free of Express. placeOrder only creates a
// Pending "preliminary" order for RazorPay and defers every side effect
// (stock, coupon usage, cart teardown) to here — none of it should happen
// until the payment signature actually verifies.

function isSignatureValid({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  const generatedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  return generatedSignature === razorpay_signature;
}

async function confirmRazorpayPayment({
  userId,
  orderId,
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
}) {
  // Scoped to the session user so a caller can't drive the payment-status
  // update against an order they don't own by passing someone else's id.
  const order = await Order.findOne({ _id: orderId, userId });
  if (!order) {
    throw notFound("Order not found");
  }

  if (!isSignatureValid({ razorpay_order_id, razorpay_payment_id, razorpay_signature })) {
    order.paymentStatus = "Failed";
    order.paymentDetails = {
      razorpayOrderId: razorpay_order_id,
      paymentStatus: "Signature Invalid",
      failureReason: "Invalid payment signature",
      paymentDate: new Date(),
    };
    await order.save();

    throw badRequest("Invalid payment signature. Payment failed.");
  }

  const user = await User.findById(order.userId);
  if (!user) {
    throw notFound("User not found");
  }

  if (order.couponCode) {
    const coupon = await Coupon.findOne({ code: order.couponCode });
    await recordCouponUsage(coupon, order.userId);
  }

  await decrementStockForItems(order.items);

  order.paymentStatus = "Completed";
  order.paymentDetails = {
    razorpayOrderId: razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
    paymentDate: new Date(),
  };

  await order.save();

  const cart = await Cart.findOne({ userId: order.userId });
  await clearCartAfterOrder(user, cart);

  return {
    clearSessionCoupon: true,
    result: { message: "Payment successful", orderId: order._id },
  };
}

/**
 * Records a verification failure against the order. Separate from the
 * happy path so the controller's catch block doesn't need to know the
 * shape of paymentDetails.
 */
async function markPaymentFailed({ userId, orderId, razorpayOrderId, reason }) {
  if (!orderId) return;

  // Same scoping as the success path — otherwise this would let a caller
  // mark an arbitrary order as Failed.
  const order = await Order.findOne({ _id: orderId, userId });
  if (!order) return;

  order.paymentStatus = "Failed";
  order.paymentDetails = {
    razorpayOrderId,
    paymentStatus: "Error During Verification",
    failureReason: reason || "Unknown error",
    paymentDate: new Date(),
  };
  await order.save();
}

module.exports = { confirmRazorpayPayment, markPaymentFailed, isSignatureValid };
