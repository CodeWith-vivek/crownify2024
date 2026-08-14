const crypto = require("crypto");
const User = require("../user/userSchema");
const Product = require("../product/productSchema");
const Order = require("../order/orderSchema");
const Cart = require("../cart/cartSchema");
const { getRazorpay } = require("../../shared/config/razorpay");
const { notFound, badRequest } = require("../../shared/errors/AppError");

// Post-checkout payment rules, free of Express: the success/failure
// screens, recording a failed payment, retrying one, and confirming a
// retry succeeded.
//
// Not to be confused with order/payment.service.js, which verifies the
// FIRST Razorpay attempt made during placeOrder. This module covers what
// happens afterwards.
//
// Every lookup here is scoped by userId. They were not: an order was
// fetched by _id or orderNumber alone, so any signed-in customer could
// read another account's order — shipping address, line items, totals —
// and, through paymentFailure, mark it Failed and delete that account's
// cart. Scoping is what makes these endpoints safe to expose.

const populateOrder = (query) =>
  query
    .populate({ path: "items.productId", strictPopulate: false })
    .populate({ path: "shippingAddress", strictPopulate: false });

async function findOwnedOrder(filter) {
  const order = await populateOrder(Order.findOne(filter)).exec();
  if (!order) throw notFound("Order not found");
  return order;
}

/** Backs both the payment-success and payment-failure screens. */
async function getOrderForReceipt({ userId, orderId }) {
  const order = await findOwnedOrder({ _id: orderId, userId });
  return { user: await User.findById(userId), order };
}

async function getOrderByNumber({ userId, orderNumber }) {
  const order = await Order.findOne({ orderNumber, userId }).populate("items.productId");
  if (!order) throw notFound("Order not found");
  return order;
}

/**
 * Records a failed Razorpay attempt and clears the cart behind it, so the
 * customer isn't left with a half-paid order and a stale cart.
 */
async function recordPaymentFailure({
  userId,
  orderId,
  paymentId,
  razorpayOrderId,
  reason,
  description,
}) {
  const order = await Order.findOne({ _id: orderId, userId });
  if (!order) throw notFound("Order not found.");

  const user = await User.findById(order.userId);
  if (!user) throw notFound("User not found.");

  order.paymentStatus = "Failed";
  order.items.forEach((item) => {
    item.orderStatus = "Failed";
  });
  order.paymentDetails = {
    paymentId,
    razorpayOrderId,
    failureReason: reason,
    failureDescription: description,
    paymentDate: new Date(),
  };
  await order.save();

  const cart = await Cart.findOne({ userId: order.userId });
  if (cart) {
    user.cart = user.cart.filter((cartId) => !cartId.equals(cart._id));
    await user.save();
    await Cart.deleteOne({ _id: cart._id });
  }

  return {
    clearSessionCoupon: true,
    result: { message: "Payment failure recorded and cart deleted." },
  };
}

/**
 * Re-checks stock before opening a second Razorpay order — between the
 * failed attempt and the retry, someone else may have bought the last one.
 */
async function retryPayment({ userId, orderNumber }) {
  if (!orderNumber) throw badRequest("orderId is required");

  const order = await Order.findOne({ orderNumber, userId }).populate("items.productId");
  if (!order) throw notFound("Order not found");

  if (!order.grandTotal || order.grandTotal <= 0) throw badRequest("Invalid order amount");

  for (const item of order.items) {
    const product = await Product.findById(item.productId);
    if (!product) throw notFound(`Product not found for item ${item.productId}`);

    const variant = product.variants.find(
      (v) => v.size === item.variant.size && v.color === item.variant.color
    );

    if (!variant) throw badRequest(`Variant not found for product ${product.productName}`);

    if (variant.quantity < item.quantity) {
      throw badRequest(
        `Insufficient stock for ${product.productName}. Available: ${variant.quantity}, Requested: ${item.quantity}`
      );
    }
  }

  const razorpayOrder = await getRazorpay().orders.create({
    amount: Math.round(order.grandTotal * 100),
    currency: "INR",
    receipt: `retry_${order.orderNumber}`,
  });

  order.razorpayOrderId = razorpayOrder.id;
  await order.save();

  return {
    key: process.env.RAZORPAY_KEY_ID,
    amount: razorpayOrder.amount,
    orderId: razorpayOrder.id,
    orderNumber: order.orderNumber,
  };
}

const isSignatureValid = ({ razorpayOrderId, paymentId, razorpaySignature }) =>
  crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${paymentId}`)
    .digest("hex") === razorpaySignature;

/** Marks a retried order paid, then decrements the stock it consumed. */
async function confirmRetriedPayment({
  userId,
  orderNumber,
  paymentId,
  razorpayOrderId,
  razorpaySignature,
  items,
}) {
  if (!orderNumber || !paymentId || !items || !razorpayOrderId || !razorpaySignature) {
    throw badRequest(
      "orderNumber, paymentId, razorpayOrderId, razorpaySignature, and items are required"
    );
  }

  if (!isSignatureValid({ razorpayOrderId, paymentId, razorpaySignature })) {
    throw badRequest("Invalid payment signature. Payment not verified.");
  }

  const order = await Order.findOne({ orderNumber, userId });
  if (!order) throw notFound("Order not found");

  order.paymentStatus = "Completed";
  order.items.forEach((item) => {
    item.orderStatus = "Placed";
  });
  await order.save();

  for (const item of items) {
    const product = await Product.findById(item.productId);
    if (!product) {
      console.error("Product not found for item:", item);
      continue;
    }

    const variant = product.variants.find(
      (v) => v.size === item.variant.size && v.color === item.variant.color
    );

    if (!variant) {
      console.error("Variant not found for product:", product.productName);
      continue;
    }

    variant.quantity -= item.quantity;
    await product.save();
  }

  return { message: "Order status updated successfully" };
}

module.exports = {
  getOrderForReceipt,
  getOrderByNumber,
  recordPaymentFailure,
  retryPayment,
  confirmRetriedPayment,
  isSignatureValid,
};
