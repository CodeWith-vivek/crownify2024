const Order = require("../order/orderSchema");
const User = require("../user/userSchema");
const Transaction = require("../payment/transactionSchema");
const { computeOrderFinancials } = require("../../shared/utils/orderFinancials");
const {
  findOrderItemIndexByVariant,
  computeItemRefund,
  restoreStockForItem,
} = require("../order/helpers/orderItems");
const { notFound, badRequest, AppError } = require("../../shared/errors/AppError");

// Admin order management, free of Express. Customer-initiated changes
// (cancel/return requests) live in order/order.service.js.

const ORDERS_PER_PAGE = 5;

// Must match cartItemSchema's orderStatus enum exactly (it uses lowercase
// "canceled" and "Return requested", not the capitalized forms) — a
// mismatch makes order.save() throw a validation error for any admin
// attempt to cancel or flag a return, surfaced as an opaque 500.
const VALID_STATUSES = [
  "Placed",
  "Shipped",
  "Delivered",
  "Returned",
  "canceled",
  "Return requested",
  "Failed",
];

// State machine: without this, any status could jump to any other in one
// call — including moving an item OUT of "Returned" and back INTO it,
// which re-runs the refund-to-wallet and restock logic every time. That's
// a double-refund / stock-inflation bug, not just a UX nicety. Terminal
// states (Returned, canceled) have no outgoing transitions.
const ALLOWED_TRANSITIONS = {
  Placed: ["Shipped", "canceled"],
  Shipped: ["Delivered", "canceled"],
  Delivered: ["Return requested"],
  "Return requested": ["Returned", "Delivered"],
  Returned: [],
  canceled: [],
  Failed: ["canceled"],
};

/**
 * The admin list searches by order number or customer.
 *
 * It used to match `{ _id: { $regex } }` and `{ "userId.name": { $regex } }`.
 * Neither works: _id is an ObjectId, so the regex fails to cast and the
 * whole query throws; and userId is a ref, so a dotted path into it matches
 * nothing without a $lookup. Customers are resolved to ids first instead,
 * and the order's own string identifier — orderNumber — is what gets
 * pattern-matched.
 */
async function buildOrderSearchQuery(search) {
  if (!search) return {};

  const pattern = { $regex: search, $options: "i" };

  const matchingUsers = await User.find({ $or: [{ name: pattern }, { email: pattern }] })
    .select("_id")
    .lean();

  return {
    $or: [
      { orderNumber: pattern },
      ...(matchingUsers.length ? [{ userId: { $in: matchingUsers.map((u) => u._id) } }] : []),
    ],
  };
}

async function listOrders({ page = 1, search = "" } = {}) {
  const limit = ORDERS_PER_PAGE;
  const query = await buildOrderSearchQuery(search);

  const [totalOrders, orders] = await Promise.all([
    Order.countDocuments(query),
    Order.find(query)
      .populate("userId", "name email")
      .populate("items.productId", "productName productImage")
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .exec(),
  ]);

  return {
    orders: orders.map((order) => ({
      ...order.toObject(),
      // order.grandTotal is frozen at checkout; this is the live figure
      // after any cancellations/returns.
      financials: computeOrderFinancials(order),
    })),
    currentPage: page,
    totalPages: Math.ceil(totalOrders / limit),
    search,
  };
}

async function getOrderDetails({ orderId, itemId }) {
  const order = await Order.findById(orderId)
    .populate("userId", "name email")
    .populate("shippingAddress");

  if (!order) throw notFound("Order not found");

  const orderItem = order.items.find((item) => item._id.toString() === itemId);
  if (!orderItem) throw notFound("Order item not found");

  return { order, orderItem, financials: computeOrderFinancials(order) };
}

/**
 * Refunds a returned item to the customer's wallet and records the ledger
 * entry. Only reached through the Return requested -> Returned transition,
 * which the state machine allows exactly once.
 */
async function refundReturnedItem(order, orderItem, productSize, productColor) {
  await restoreStockForItem(orderItem, productSize, productColor);

  // Same value-share formula used by the customer cancel flow, the credit
  // note, and the sales report's return rows.
  const { refundAmount } = computeItemRefund(order, orderItem);

  const user = await User.findById(order.userId);
  if (!user) throw notFound("User not found for refund");

  user.wallet = (user.wallet || 0) + refundAmount;
  await user.save();

  await new Transaction({
    userId: order.userId,
    amount: refundAmount,
    type: "credit",
    description: `Refund for returned order item: ${orderItem.productName}`,
  }).save();

  return refundAmount;
}

async function updateOrderItemStatus({ orderId, productSize, productColor, newStatus }) {
  if (!orderId || !productSize || !productColor || !newStatus) {
    throw badRequest("Missing required fields");
  }

  if (!VALID_STATUSES.includes(newStatus)) throw badRequest("Invalid status provided");

  const order = await Order.findById(orderId);
  if (!order) throw notFound("Order not found");

  const index = findOrderItemIndexByVariant(order, productSize, productColor);
  if (index === -1) {
    throw new AppError("Product not found in order", {
      status: 404,
      details: {
        debug: {
          receivedData: { size: productSize, color: productColor },
          availableItems: order.items.map((item) => item.variant),
        },
      },
    });
  }

  const orderItem = order.items[index];

  if (orderItem.orderStatus === newStatus) {
    throw badRequest(`This item is already marked as ${newStatus}`);
  }

  const allowedNext = ALLOWED_TRANSITIONS[orderItem.orderStatus] || [];
  if (!allowedNext.includes(newStatus)) {
    throw badRequest(
      `Cannot change status from "${orderItem.orderStatus}" to "${newStatus}".`
    );
  }

  const refundAmount =
    newStatus === "Returned"
      ? await refundReturnedItem(order, orderItem, productSize, productColor)
      : 0;

  order.items[index].orderStatus = newStatus;

  // Timestamp the transition so sales reporting can tell WHEN a return was
  // processed, separately from when the item was originally sold
  // (orderedAt) — see buildReturnRows.
  if (newStatus === "Returned") order.items[index].returnedAt = new Date();
  else if (newStatus === "canceled") order.items[index].canceledAt = new Date();

  // Only COD is collected on delivery; prepaid methods are already
  // Completed at placement. Cancelling or returning must not stamp the
  // order as paid-in-full.
  if (newStatus === "Delivered" && order.paymentMethod === "COD") {
    order.paymentStatus = "Completed";
  }

  await order.save();

  return {
    message: `Order item status updated to ${newStatus} successfully`,
    refundAmount,
    updatedOrder: order,
  };
}

module.exports = {
  listOrders,
  getOrderDetails,
  updateOrderItemStatus,
  buildOrderSearchQuery,
  VALID_STATUSES,
  ALLOWED_TRANSITIONS,
  ORDERS_PER_PAGE,
};
