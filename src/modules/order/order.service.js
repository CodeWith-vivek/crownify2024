const Order = require("./orderSchema");
const Cart = require("../cart/cartSchema");
const Address = require("../address/addressSchema");
const Coupon = require("../coupon/couponSchema");
const User = require("../user/userSchema");
const Transaction = require("../payment/transactionSchema");
const { AppError, notFound, badRequest } = require("../../shared/errors/AppError");
const { getRazorpay } = require("../../shared/config/razorpay");
const {
  generateOrderNumber,
  recordCouponUsage,
  clearCartAfterOrder,
  buildOrderItems,
  calculateCouponDiscount,
  removeItemFromCart,
  CheckoutError,
} = require("./helpers/checkout");
const {
  findOrderItemIndexByVariant,
  computeItemRefund,
  restoreStockForItem,
  decrementStockForItems,
} = require("./helpers/orderItems");

/**
 * Order business logic, deliberately free of Express.
 *
 * Nothing here touches req, res or the session: callers pass plain values
 * in and get plain values (or an AppError) back. That keeps the rules
 * testable without spinning up HTTP or faking req/res, and means the same
 * logic could be driven by a queue worker or a CLI without change.
 *
 * The session coupon is the one piece of request state that genuinely
 * affects these rules, so it's passed IN as a plain object, and the
 * decision to clear it comes back OUT as a `clearSessionCoupon` flag for
 * the controller to act on. The service never mutates the session itself.
 */

/**
 * @returns {Promise<{result: object, clearSessionCoupon: boolean}>}
 * @throws {AppError} with `details.clearSessionCoupon` where the caller
 *   should also drop the applied coupon.
 */
async function placeOrder({
  userId,
  primaryAddressId,
  subtotal,
  shipping,
  paymentMethod,
  sessionCoupon,
}) {
  const user = await User.findById(userId);
  if (!user) {
    throw notFound("User not found", { clearSessionCoupon: true });
  }

  const hasPendingCoupon = Boolean(sessionCoupon && sessionCoupon.temporary);

  if (hasPendingCoupon) {
    const couponExists = await Coupon.findOne({ code: sessionCoupon.code });
    if (!couponExists) {
      throw badRequest(
        "The applied coupon is no longer valid. Please refresh and try again.",
        { clearSessionCoupon: true }
      );
    }
  }

  const subtotalValue = Math.floor(Number(subtotal));
  const totalBeforeDiscount = Math.floor(subtotalValue + Number(shipping));

  const cart = await Cart.findOne({ userId });
  if (!cart || cart.items.length === 0) {
    throw notFound("No items in the cart to proceed", { clearSessionCoupon: true });
  }

  // Re-validates every line against live catalog state and freezes prices.
  let orderProducts;
  try {
    orderProducts = await buildOrderItems(cart);
  } catch (error) {
    if (error instanceof CheckoutError) {
      if (error.productIdToRemove) {
        await removeItemFromCart(cart._id, error.productIdToRemove);
      }
      throw new AppError(error.message, {
        status: error.status,
        meta: { clearSessionCoupon: true },
      });
    }
    throw error;
  }

  const primaryAddress = await Address.findOne({ _id: primaryAddressId, userId });
  if (!primaryAddress) {
    // Deliberately does NOT clear the coupon — the cart is still valid and
    // the shopper just needs to pick an address.
    throw notFound("Primary address not found");
  }

  let discount = 0;
  let appliedCoupon = null;
  let couponToApply = null;
  if (hasPendingCoupon) {
    const coupon = await Coupon.findOne({ code: sessionCoupon.code });
    if (!coupon) {
      throw badRequest("The applied coupon is no longer valid. Please refresh and try again.");
    }
    couponToApply = coupon;
    appliedCoupon = coupon.code;
    discount = calculateCouponDiscount(coupon, totalBeforeDiscount);
  }

  const grandTotal = Math.floor(totalBeforeDiscount - discount);

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
      throw badRequest("Insufficient wallet balance");
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
    await clearCartAfterOrder(user, cart);

    return {
      clearSessionCoupon: true,
      result: {
        message: "Order placed successfully using wallet",
        orderId: order._id,
        orderedItems: orderProducts,
      },
    };
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
      throw new AppError("Failed to create RazorPay order", { status: 500 });
    }

    // No stock decrement, coupon usage or cart teardown here — the money
    // hasn't moved yet. All of that happens in confirmRazorpayPayment once
    // the signature verifies. The session coupon likewise survives.
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

    return {
      clearSessionCoupon: false,
      result: {
        message: "Razorpay order created",
        razorpayOrderId: razorpayOrder.id,
        amount: Math.round(grandTotal * 100),
        key: process.env.RAZORPAY_KEY_ID,
        orderId: preliminaryOrder._id,
      },
    };
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
    await clearCartAfterOrder(user, cart);

    return {
      clearSessionCoupon: true,
      result: {
        message: "Order placed successfully with Cash on Delivery",
        orderId: order._id,
        orderedItems: orderProducts,
      },
    };
  }

  throw badRequest(`Unsupported payment method: ${paymentMethod}`);
}

/**
 * Loads an order scoped to its owner and locates one line by variant.
 * Scoping by userId is what stops any signed-in user acting on someone
 * else's order by passing its number.
 */
async function resolveOrderItem({ userId, orderNumber, productSize, productColor }) {
  if (!orderNumber || !productSize || !productColor) {
    throw badRequest("Missing required fields");
  }

  const order = await Order.findOne({ orderNumber, userId });
  if (!order) {
    throw notFound("Order not found");
  }

  const orderItemIndex = findOrderItemIndexByVariant(order, productSize, productColor);
  if (orderItemIndex === -1) {
    throw notFound("Product not found in order");
  }

  return { order, orderItem: order.items[orderItemIndex], orderItemIndex };
}

async function cancelOrderItem({ userId, orderNumber, productSize, productColor, cancelComment }) {
  const { order, orderItem, orderItemIndex } = await resolveOrderItem({
    userId,
    orderNumber,
    productSize,
    productColor,
  });

  // A Failed item never took payment and never reserved stock — mark it
  // cancelled with no refund and no restock.
  if (orderItem.orderStatus === "Failed") {
    if (cancelComment) order.items[orderItemIndex].cancelComment = cancelComment;
    order.items[orderItemIndex].orderStatus = "canceled";
    order.items[orderItemIndex].canceledAt = new Date();
    order.items[orderItemIndex].paymentStatus = "Failed";

    await order.save();

    return {
      message:
        "Failed order item marked as canceled successfully. No refund or inventory restoration applied.",
    };
  }

  if (orderItem.orderStatus === "canceled") {
    throw badRequest("This item is already canceled");
  }

  await restoreStockForItem(orderItem, productSize, productColor);

  const { itemShare, refundAmount } = computeItemRefund(order, orderItem);
  let refundShipping = 0;

  // COD collected nothing yet, so there's nothing to refund — only
  // prepaid methods credit the wallet back.
  if (order.paymentMethod === "RazorPay" || order.paymentMethod === "Wallet") {
    const user = await User.findById(userId);
    if (!user) {
      throw notFound("User  not found for wallet refund");
    }

    refundShipping = Math.round((order.shipping || 0) * itemShare);
    user.wallet = (user.wallet || 0) + refundAmount + refundShipping;
    order.shipping -= refundShipping;

    await user.save();

    await new Transaction({
      userId,
      amount: refundAmount + refundShipping,
      type: "credit",
      description: `Refund for canceled order item: ${orderItem.productName}`,
    }).save();
  }

  order.items[orderItemIndex].orderStatus = "canceled";
  order.items[orderItemIndex].canceledAt = new Date();
  if (cancelComment) order.items[orderItemIndex].cancelComment = cancelComment;
  await order.save();

  return { message: "Order item canceled successfully", refundAmount, refundShipping };
}

async function requestReturn({ userId, orderNumber, productSize, productColor, returnComment }) {
  const { order, orderItem, orderItemIndex } = await resolveOrderItem({
    userId,
    orderNumber,
    productSize,
    productColor,
  });

  if (orderItem.orderStatus === "Return requested") {
    throw badRequest("This item is already in the return process");
  }

  // Only flags the request — the refund and restock happen when an admin
  // approves it (admin/adminOrders.controller.js).
  order.items[orderItemIndex].orderStatus = "Return requested";
  if (returnComment) order.items[orderItemIndex].returnComment = returnComment;

  await order.save();

  return { message: "Return request submitted successfully", updatedOrder: order };
}

async function cancelReturnRequest({ userId, orderNumber, productSize, productColor }) {
  const { order, orderItem } = await resolveOrderItem({
    userId,
    orderNumber,
    productSize,
    productColor,
  });

  if (orderItem.orderStatus !== "Return requested") {
    throw badRequest("This item has no pending return request to cancel");
  }

  const refundAmount = Math.floor(orderItem.totalPrice);
  orderItem.orderStatus = "Delivered";

  await order.save();

  return { message: "Return request canceled successfully", refundAmount };
}

async function deletePreliminaryOrder({ userId, orderId }) {
  if (!orderId) {
    throw badRequest("Order ID is required for deletion");
  }

  const order = await Order.findOne({ _id: orderId, userId });
  if (!order) {
    throw notFound("Order not found");
  }

  if (order.paymentStatus !== "Pending") {
    throw badRequest("Only pending orders can be deleted");
  }

  await Order.findByIdAndDelete(orderId);

  return { message: "Preliminary order deleted successfully" };
}

module.exports = {
  placeOrder,
  cancelOrderItem,
  requestReturn,
  cancelReturnRequest,
  deletePreliminaryOrder,
  resolveOrderItem,
};
