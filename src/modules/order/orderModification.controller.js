const Order = require("./orderSchema");
const User = require("../user/userSchema");
const Transaction = require("../payment/transactionSchema");
const {
  findOrderItemIndexByVariant,
  computeItemRefund,
  restoreStockForItem,
} = require("./helpers/orderItems");

// Customer-initiated changes to an existing order: cancel a line, request
// a return, withdraw a return request. Admin-side status transitions live
// in admin/adminController.js.

/**
 * All three endpoints start the same way: validate the payload, load the
 * order scoped to the session user (never by orderNumber alone — otherwise
 * any signed-in user could act on someone else's order), then locate the
 * line by its variant.
 *
 * @returns {{ error: object }|{ order, orderItem, orderItemIndex }}
 */
async function resolveOrderItem(req) {
  const { orderNumber, productSize, productColor } = req.body;

  if (!orderNumber || !productSize || !productColor) {
    return {
      error: {
        status: 400,
        body: { success: false, message: "Missing required fields", receivedData: req.body },
      },
    };
  }

  const order = await Order.findOne({ orderNumber, userId: req.session.user });
  if (!order) {
    return { error: { status: 404, body: { success: false, message: "Order not found" } } };
  }

  const orderItemIndex = findOrderItemIndexByVariant(order, productSize, productColor);
  if (orderItemIndex === -1) {
    return {
      error: { status: 404, body: { success: false, message: "Product not found in order" } },
    };
  }

  return { order, orderItem: order.items[orderItemIndex], orderItemIndex };
}

const cancelOrder = async (req, res) => {
  try {
    const { productSize, productColor, cancelComment } = req.body;

    const resolved = await resolveOrderItem(req);
    if (resolved.error) {
      return res.status(resolved.error.status).json(resolved.error.body);
    }
    const { order, orderItem, orderItemIndex } = resolved;

    // A Failed item never took payment and never reserved stock, so it's
    // marked cancelled without a refund or a stock restore.
    if (orderItem.orderStatus === "Failed") {
      if (cancelComment) order.items[orderItemIndex].cancelComment = cancelComment;
      order.items[orderItemIndex].orderStatus = "canceled";
      order.items[orderItemIndex].canceledAt = new Date();
      order.items[orderItemIndex].paymentStatus = "Failed";

      await order.save();

      return res.status(200).json({
        success: true,
        message:
          "Failed order item marked as canceled successfully. No refund or inventory restoration applied.",
      });
    }

    if (orderItem.orderStatus === "canceled") {
      return res.status(400).json({ success: false, message: "This item is already canceled" });
    }

    await restoreStockForItem(orderItem, productSize, productColor);

    const { itemShare, refundAmount } = computeItemRefund(order, orderItem);
    let refundShipping = 0;

    // COD hasn't collected anything yet, so there's nothing to refund —
    // only prepaid methods credit the wallet back.
    if (order.paymentMethod === "RazorPay" || order.paymentMethod === "Wallet") {
      const user = await User.findById(req.session.user);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User  not found for wallet refund",
        });
      }

      user.wallet = (user.wallet || 0) + refundAmount;

      refundShipping = Math.round((order.shipping || 0) * itemShare);
      user.wallet += refundShipping;
      order.shipping -= refundShipping;

      await user.save();

      await new Transaction({
        userId: req.session.user,
        amount: refundAmount + refundShipping,
        type: "credit",
        description: `Refund for canceled order item: ${orderItem.productName}`,
      }).save();
    }

    order.items[orderItemIndex].orderStatus = "canceled";
    order.items[orderItemIndex].canceledAt = new Date();
    if (cancelComment) order.items[orderItemIndex].cancelComment = cancelComment;
    await order.save();

    res.status(200).json({
      success: true,
      message: "Order item canceled successfully",
      refundAmount,
      refundShipping,
    });
  } catch (error) {
    console.error("Cancel product error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error canceling product from order",
      receivedData: req.body,
    });
  }
};

const returnItem = async (req, res) => {
  try {
    const { returnComment } = req.body;

    const resolved = await resolveOrderItem(req);
    if (resolved.error) {
      return res.status(resolved.error.status).json(resolved.error.body);
    }
    const { order, orderItem, orderItemIndex } = resolved;

    if (orderItem.orderStatus === "Return requested") {
      return res.status(400).json({
        success: false,
        message: "This item is already in the return process",
      });
    }

    // Only flags the request — the refund and stock restore happen when an
    // admin actually approves it (admin/adminController.js).
    order.items[orderItemIndex].orderStatus = "Return requested";
    if (returnComment) order.items[orderItemIndex].returnComment = returnComment;

    await order.save();

    res.json({
      success: true,
      message: "Return request submitted successfully",
      updatedOrder: order,
    });
  } catch (error) {
    console.error("Return request error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error requesting return for product",
      receivedData: req.body,
    });
  }
};

const cancelReturn = async (req, res) => {
  try {
    const resolved = await resolveOrderItem(req);
    if (resolved.error) {
      return res.status(resolved.error.status).json(resolved.error.body);
    }
    const { order, orderItem } = resolved;

    // Was checking orderStatus === "Canceled" — a value this field never
    // actually holds (the enum uses lowercase "canceled", and cancelling a
    // RETURN REQUEST has nothing to do with the item being cancelled
    // anyway). The check that actually matches this action's precondition:
    // there must be a return request in flight to cancel.
    if (orderItem.orderStatus !== "Return requested") {
      return res.status(400).json({
        success: false,
        message: "This item has no pending return request to cancel",
      });
    }

    const refundAmount = Math.floor(orderItem.totalPrice);

    orderItem.orderStatus = "Delivered";

    await order.save();

    return res.json({
      success: true,
      message: "Return request canceled successfully",
      refundAmount,
    });
  } catch (error) {
    console.error("Error canceling return request:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

module.exports = { cancelOrder, returnItem, cancelReturn };
