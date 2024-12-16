const User = require("../models/userSchema");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Order = require("../models/orderSchema");
const Product = require("../models/productSchema");
const { session } = require("passport");


//admin side page error

const pageerror = async (req, res) => {
  res.render("admin-error");
};

//admin login 
const loadLogin = (req, res) => {
  if (req.session.admin) {
    return res.redirect("/admin/dashboard");
  }
  res.render("admin-login", { message: null });
};


//admin login code
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await User.findOne({ email, isAdmin: true });

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
      res.render("dashboard"); 
    } catch (error) {
      res.redirect("/admin/pageerror");
    }
  } else {
    res.redirect("/admin/login"); 
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
    const limit = 2;
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

    res.render("orderlist", {
      orders,
      currentPage: page,
      totalPages,
      search,
    });
  } catch (error) {
    console.error("Error loading orders:", error);
    res.status(500).send("Server Error");
  }
};

//code to change status of order by admin

const updateOrderStatusByAdmin = async (req, res) => {
  try {
    const { orderId, productSize, productColor, newStatus } = req.body;

    // Validate required fields
    if (!orderId || !productSize || !productColor || !newStatus) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        receivedData: req.body,
      });
    }

    // Valid statuses
    const validStatuses = [
      "Placed",
      "Shipped",
      "Delivered",
      "Returned",
      "Canceled",
      "Return Requested",
    ];
    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status provided",
      });
    }

    // Fetch the order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Find the order item based on size and color
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
          availableItems: order.items.map((item) => ({
            variant: item.variant,
          })),
        },
      });
    }

    const orderItem = order.items[orderItemIndex];

    // Check if the status is already updated
    if (orderItem.orderStatus === newStatus) {
      return res.status(400).json({
        success: false,
        message: `This item is already marked as ${newStatus}`,
      });
    }

    const productIdFromOrder = orderItem.productId;

    if (newStatus === "Returned") {
      // Handle inventory update for returned items
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

      // Refund logic for all payment methods
      const totalOrderPrice = order.items.reduce(
        (sum, item) => sum + item.totalPrice,
        0
      );

      // Calculate the item's share (ratio) of the total price
      const itemShare = orderItem.totalPrice / totalOrderPrice;

      // Calculate the proportional discount for this item
      const discountForItem = Math.floor(order.discount * itemShare);

      // Refund amount calculation
      const refundAmount = Math.floor(orderItem.totalPrice - discountForItem);
      const userId = order.userId;

      // Adjust the user's wallet
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found for refund",
        });
      }

      user.wallet = Math.floor((user.wallet || 0) + refundAmount);

      await user.save();
    }

    // Update the order item status
    order.items[orderItemIndex].orderStatus = newStatus;

    // Check if all items have the same status
    const allItemsSameStatus = order.items.every(
      (item) => item.orderStatus === newStatus
    );
    if (allItemsSameStatus) {
      order.orderStatus = newStatus;
    }

    await order.save();

    res.json({
      success: true,
      message: `Order item status updated to ${newStatus} successfully`,
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
        return res.redirect("/admin/pageerror");
      }

     
      const orderItem = order.items.find(
        (item) => item._id.toString() === itemId
      );

      if (!orderItem) {
        return res.redirect("/admin/pageerror");
      }

      res.render("orderDetails", {
        order,
        orderItem, 
      });
    } catch (error) {
      console.error("Error loading order details:", error);
      res.redirect("/admin/pageerror");
    }
  } else {
    res.redirect("/admin/login");
  }
};
module.exports = {
  loadLogin,
  login,
  loadDashboard,
  pageerror,
  logout,
  loadOrderlist,
  loadOrderDetails,
  updateOrderStatusByAdmin,
};
