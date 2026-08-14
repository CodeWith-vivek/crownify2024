const Order = require("../order/orderSchema");
const User = require("../user/userSchema");
const Transaction = require("../payment/transactionSchema");
const { computeOrderFinancials } = require("../../shared/utils/orderFinancials");
const {
  findOrderItemIndexByVariant,
  computeItemRefund,
  restoreStockForItem,
} = require("../order/helpers/orderItems");

// Admin order management: the paginated list, a single order's detail, and
// the status transitions an admin can drive. Customer-initiated changes
// (cancel/return requests) live in order/orderModification.controller.js.

// Must match cartItemSchema's orderStatus enum exactly (it uses lowercase
// "canceled" and "Return requested", not the capitalized forms this used
// to list) — a mismatch made order.save() throw a validation error for any
// admin attempt to cancel or flag a return, surfaced as an opaque 500.
const VALID_STATUSES = [
  "Placed",
  "Shipped",
  "Delivered",
  "Returned",
  "canceled",
  "Return requested",
  "Failed",
];

// State machine: without this, any status could jump to any other status
// in one call — including moving an item OUT of "Returned" and back INTO
// it, which re-runs the refund-to-wallet and restock-inventory logic every
// time. That's a double-refund / stock-inflation bug, not just a UX
// nicety. Terminal states (Returned, canceled) have no outgoing
// transitions, closing that off.
const ALLOWED_TRANSITIONS = {
  Placed: ["Shipped", "canceled"],
  Shipped: ["Delivered", "canceled"],
  Delivered: ["Return requested"],
  "Return requested": ["Returned", "Delivered"],
  Returned: [],
  canceled: [],
  Failed: ["canceled"],
};

const loadOrderlist = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search ? req.query.search.trim() : "";
    const limit = 5;
    const query = search
      ? {
          $or: [
            { _id: { $regex: search, $options: "i" } },
            { "userId.name": { $regex: search, $options: "i" } },
          ],
        }
      : {};

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

    const ordersWithFinancials = orders.map((order) => ({
      ...order.toObject(),
      // order.grandTotal is frozen at checkout; this is the live figure
      // after any cancellations/returns.
      financials: computeOrderFinancials(order),
    }));

    res.json({
      success: true,
      orders: ordersWithFinancials,
      currentPage: page,
      totalPages: Math.ceil(totalOrders / limit),
      search,
    });
  } catch (error) {
    console.error("Error loading orders:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const loadOrderDetails = async (req, res) => {
  if (!req.session.admin) {
    return res.status(401).json({ success: false, message: "Not authenticated as admin" });
  }

  try {
    const orderId = req.params.id;
    const itemId = req.query.itemId;

    const order = await Order.findById(orderId)
      .populate("userId", "name email")
      .populate("shippingAddress");

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const orderItem = order.items.find((item) => item._id.toString() === itemId);

    if (!orderItem) {
      return res.status(404).json({ success: false, message: "Order item not found" });
    }

    res.json({
      success: true,
      order,
      orderItem,
      financials: computeOrderFinancials(order),
    });
  } catch (error) {
    console.error("Error loading order details:", error);
    res.status(500).json({ success: false, message: "Error loading order details" });
  }
};

const updateOrderStatusByAdmin = async (req, res) => {
  try {
    const { orderId, productSize, productColor, newStatus } = req.body;

    if (!orderId || !productSize || !productColor || !newStatus) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        receivedData: req.body,
      });
    }

    if (!VALID_STATUSES.includes(newStatus)) {
      return res.status(400).json({ success: false, message: "Invalid status provided" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const orderItemIndex = findOrderItemIndexByVariant(order, productSize, productColor);

    if (orderItemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Product not found in order",
        debug: {
          receivedData: { size: productSize, color: productColor },
          availableItems: order.items.map((item) => item.variant),
        },
      });
    }

    const orderItem = order.items[orderItemIndex];

    if (orderItem.orderStatus === newStatus) {
      return res.status(400).json({
        success: false,
        message: `This item is already marked as ${newStatus}`,
      });
    }

    const allowedNext = ALLOWED_TRANSITIONS[orderItem.orderStatus] || [];
    if (!allowedNext.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change status from "${orderItem.orderStatus}" to "${newStatus}".`,
      });
    }

    let refundAmount = 0;

    if (newStatus === "Returned") {
      await restoreStockForItem(orderItem, productSize, productColor);

      // Same value-share formula used by the customer cancel flow, the
      // credit note, and the sales report's return rows.
      ({ refundAmount } = computeItemRefund(order, orderItem));

      const user = await User.findById(order.userId);
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found for refund" });
      }

      user.wallet = (user.wallet || 0) + refundAmount;
      await user.save();

      await new Transaction({
        userId: order.userId,
        amount: refundAmount,
        type: "credit",
        description: `Refund for returned order item: ${orderItem.productName}`,
      }).save();
    }

    order.items[orderItemIndex].orderStatus = newStatus;

    // Timestamp the transition so sales reporting can tell WHEN a return
    // was processed, separately from when the item was originally sold
    // (orderedAt). Without this a return could only be dated by the
    // order's purchase date, which made it retroactively vanish from the
    // figures of the month it was actually SOLD in — see buildReturnRows.
    if (newStatus === "Returned") {
      order.items[orderItemIndex].returnedAt = new Date();
    } else if (newStatus === "canceled") {
      order.items[orderItemIndex].canceledAt = new Date();
    }

    // Previously ran on every transition EXCEPT Shipped+COD — which meant
    // cancelling or returning an item also stamped the order as
    // "Completed". A canceled order should not read as paid-in-full. Only
    // COD is collected on delivery; prepaid methods are already Completed
    // at placement and don't need touching here.
    if (newStatus === "Delivered" && order.paymentMethod === "COD") {
      order.paymentStatus = "Completed";
    }

    // order.orderStatus used to be written here, but it isn't a field this
    // schema declares (see orderSchema.js) — Mongoose's strict mode
    // silently dropped every write, and nothing ever read it back. Removed
    // rather than "fixed": a per-item order has no single meaningful
    // order-level status, and the UI already renders each item's status.

    await order.save();

    res.json({
      success: true,
      message: `Order item status updated to ${newStatus} successfully`,
      refundAmount,
      updatedOrder: order,
    });
  } catch (error) {
    console.error("Admin order status update error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error updating order status",
      receivedData: req.body,
    });
  }
};

module.exports = { loadOrderlist, loadOrderDetails, updateOrderStatusByAdmin };
