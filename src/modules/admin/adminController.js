const User = require("../user/userSchema");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Order = require("../order/orderSchema");
const Product = require("../product/productSchema");
const { session } = require("passport");
const Transaction = require("../payment/transactionSchema");
const { asString } = require("../../shared/utils/sanitize");
const { computeOrderFinancials } = require("../../shared/utils/orderFinancials");


//admin side page error

const pageerror = async (req, res) => {
  res.json({ success: true });
};

//admin login 

const loadLogin = (req, res) => {
  if (req.session.admin) {
    return res.json({ success: true, redirect: "/admin/dashboard" });
  }
  res.json({ success: true, admin: false });
};

const getCurrentAdmin = (req, res) => {
  res.json({ success: true, admin: !!req.session.admin });
};


//admin login code

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await User.findOne({ email: asString(email), isAdmin: true }).select("+password");

    if (admin) {
      const passwordMatch = await bcrypt.compare(password, admin.password);
      if (passwordMatch) {
        req.session.admin = true; 

        return res.json({
          success: true,
          message: "Login Successful",
          redirectUrl: "/admin/dashboard",
        });
      } else {
        return res.json({ success: false, message: "Invalid Password" }); 
      }
    } else {
      return res.json({ success: false, message: "You are not Admin !" });
    }
  } catch (error) {
    console.error("Login error:", error);
    return res.json({ success: false, message: "An error occurred" }); 
  }
};

// code to load dashboard

const loadDashboard = async (req, res) => {
  if (req.session.admin) {
    try {
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error loading dashboard" });
    }
  } else {
    res.status(401).json({ success: false, message: "Not authenticated as admin" });
  }
};

//code to logout admin


const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.log("Error in logging out",err);
        return res.json({ success: false, message: "Error logging out" });
      }

      res.json({ success: true, message: "Logged out successfully" });
    });
  } catch (error) {
    console.log("Unexpected error occurred", error);
    res.json({ success: false, message: "An unexpected error occurred" });
  }
};


// code to load orderlist in admin side

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

    
    const totalOrders = await Order.countDocuments(query);

    
    const orders = await Order.find(query)
      .populate("userId", "name email")
      .populate("items.productId", "productName productImage")
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .exec();

    
    const totalPages = Math.ceil(totalOrders / limit);

    const ordersWithFinancials = orders.map((order) => ({
      ...order.toObject(),
      financials: computeOrderFinancials(order),
    }));

    const orderlistData = { orders: ordersWithFinancials, currentPage: page, totalPages, search };
    res.json({ success: true, ...orderlistData });
  } catch (error) {
    console.error("Error loading orders:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

//code to change status of order by admin


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

    // Must match cartItemSchema's orderStatus enum exactly (it uses
    // lowercase "canceled" and "Return requested", not the capitalized
    // forms this used to list) — a mismatch here made order.save() below
    // throw a validation error for any admin attempt to cancel or flag a
    // return, surfaced to the client as an opaque 500.
    const validStatuses = [
      "Placed",
      "Shipped",
      "Delivered",
      "Returned",
      "canceled",
      "Return requested",
      "Failed",
    ];
    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status provided",
      });
    }

    // State machine: without this, any status could jump to any other
    // status in one call — including moving an item OUT of "Returned" and
    // back INTO it, which re-runs the refund-to-wallet and restock-inventory
    // logic below every time. That's a double-refund / stock-inflation bug,
    // not just a UX nicety. Terminal states (Returned, canceled) have no
    // outgoing transitions here, closing that off. This mirrors exactly the
    // transitions the admin UI's nextStatusFor() ever sends, plus a couple
    // of reasonable admin-initiated equivalents (cancel from Placed/Shipped,
    // decline a return request back to Delivered).
    const ALLOWED_TRANSITIONS = {
      Placed: ["Shipped", "canceled"],
      Shipped: ["Delivered", "canceled"],
      Delivered: ["Return requested"],
      "Return requested": ["Returned", "Delivered"],
      Returned: [],
      canceled: [],
      Failed: ["canceled"],
    };

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const orderItemIndex = order.items.findIndex((item) => {
      if (!item.variant) return false;

      const itemSize = item.variant.size.toUpperCase();
      const requestSize = productSize.toUpperCase();

      const itemColor = item.variant.color.toUpperCase();
      const requestColor = productColor.toUpperCase();

      return itemSize === requestSize && itemColor === requestColor;
    });

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

    const productIdFromOrder = orderItem.productId;

    let refundAmount = 0;

    if (newStatus === "Returned") {
      const product = await Product.findById(productIdFromOrder);
      if (product) {
        const variantIndex = product.variants.findIndex(
          (v) =>
            v.size.toUpperCase() === productSize.toUpperCase() &&
            v.color.toUpperCase() === productColor.toUpperCase()
        );

        if (variantIndex !== -1) {
          product.variants[variantIndex].quantity += orderItem.quantity;
          await product.save();
        }
      }

      const totalOrderPrice = order.items.reduce(
        (sum, item) => sum + item.totalPrice,
        0
      );

      const itemShare = orderItem.totalPrice / totalOrderPrice;
      // Round rather than floor — flooring both the discount share and the
      // refund systematically shortchanges the customer by up to a couple
      // rupees on every return.
      const discountForItem = Math.round(order.discount * itemShare);
      refundAmount = Math.round(orderItem.totalPrice - discountForItem);

      const user = await User.findById(order.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found for refund",
        });
      }

      user.wallet = (user.wallet || 0) + refundAmount;
      await user.save();

      const transaction = new Transaction({
        userId: order.userId,
        amount: refundAmount,
        type: "credit",
        description: `Refund for returned order item: ${orderItem.productName}`,
      });
      await transaction.save();
    }

    order.items[orderItemIndex].orderStatus = newStatus;

    // Timestamp the transition so sales reporting can tell WHEN a return was
    // processed, separately from when the item was originally sold
    // (orderedAt). Without this, a return could only be dated by looking at
    // the order's original purchase date, which is what caused the return to
    // retroactively vanish from the sales figures of the month it was
    // actually SOLD in — see buildSalesRows / buildReturnRows.
    if (newStatus === "Returned") {
      order.items[orderItemIndex].returnedAt = new Date();
    } else if (newStatus === "canceled") {
      order.items[orderItemIndex].canceledAt = new Date();
    }

    // Previously this ran on every transition EXCEPT Shipped+COD — which
    // meant canceling or returning an item also stamped the order's
    // paymentStatus as "Completed". A canceled order should not read as
    // paid-in-full. Only mark it Completed when it's actually collected:
    // COD payment is collected on delivery; prepaid methods are already
    // Completed at order placement and don't need touching here.
    if (newStatus === "Delivered" && order.paymentMethod === "COD") {
      order.paymentStatus = "Completed";
    }

    // order.orderStatus used to be written here, but it isn't a field this
    // schema declares (see orderSchema.js) — Mongoose's default strict mode
    // silently drops writes to undeclared paths, so this never actually
    // persisted, and nothing in the codebase ever read it back. Removed
    // rather than "fixed": a per-item order has no single meaningful
    // order-level status to store — the UI already renders each item's
    // status independently, which is the correct source of truth.

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


//code to load order details page

const loadOrderDetails = async (req, res) => {
  if (req.session.admin) {
    try {
      const orderId = req.params.id;
      const itemId = req.query.itemId;

      const order = await Order.findById(orderId)
        .populate("userId", "name email")
        .populate("shippingAddress");

      if (!order) {
        return res.status(404).json({ success: false, message: "Order not found" });
      }


      const orderItem = order.items.find(
        (item) => item._id.toString() === itemId
      );

      if (!orderItem) {
        return res.status(404).json({ success: false, message: "Order item not found" });
      }

      const financials = computeOrderFinancials(order);
      res.json({ success: true, order, orderItem, financials });
    } catch (error) {
      console.error("Error loading order details:", error);
      res.status(500).json({ success: false, message: "Error loading order details" });
    }
  } else {
    res.status(401).json({ success: false, message: "Not authenticated as admin" });
  }
};
module.exports = {
  loadLogin,
  getCurrentAdmin,
  login,
  loadDashboard,
  pageerror,
  logout,
  loadOrderlist,
  loadOrderDetails,
  updateOrderStatusByAdmin,
};
