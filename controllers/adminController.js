const User = require("../models/userSchema");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Order = require("../models/orderSchema");
const Product = require("../models/productSchema");
const { session } = require("passport");
const pageerror = async (req, res) => {
  res.render("admin-error");
};
const loadLogin = (req, res) => {
  if (req.session.admin) {
    return res.redirect("/admin/dashboard");
  }
  res.render("admin-login", { message: null });
};
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await User.findOne({ email, isAdmin: true });

    if (admin) {
      const passwordMatch = await bcrypt.compare(password, admin.password);
      if (passwordMatch) {
        req.session.admin = true; // Set session for the logged-in admin

        // Return success response with redirect URL
        return res.json({
          success: true,
          message: "Login Successful",
          redirectUrl: "/admin/dashboard",
        });
      } else {
        return res.json({ success: false, message: "Invalid Password" }); // Return error response
      }
    } else {
      return res.json({ success: false, message: "You are not Admin !" }); // Return error response
    }
  } catch (error) {
    console.error("Login error:", error);
    return res.json({ success: false, message: "An error occurred" }); // Return error response
  }
};
const loadDashboard = async (req, res) => {
  if (req.session.admin) {
    try {
      res.render("dashboard"); // Render the admin dashboard
    } catch (error) {
      res.redirect("/admin/pageerror");
    }
  } else {
    res.redirect("/admin/login"); // Redirect to login if not logged in
  }
};

// to load
const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.log("Error in logging out",err);
        return res.json({ success: false, message: "Error logging out" });
      }

      // Send success response instead of redirecting
      res.json({ success: true, message: "Logged out successfully" });
    });
  } catch (error) {
    console.log("Unexpected error occurred", error);
    res.json({ success: false, message: "An unexpected error occurred" });
  }
};



const loadOrderlist = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Current page
    const search = req.query.search ? req.query.search.trim() : ""; // Search query
    const limit = 2;
    const query = search
      ? {
          $or: [
            { _id: { $regex: search, $options: "i" } }, // Search by Order ID
            { "userId.name": { $regex: search, $options: "i" } }, // Search by User Name
          ],
        }
      : {};

    // Get total orders for pagination
    const totalOrders = await Order.countDocuments(query);

    // Fetch orders with pagination
    const orders = await Order.find(query)
      .populate("userId", "name email") // Populate user details
      .populate("items.productId", "productName productImage") // Populate product details
      .limit(limit)
      .skip((page - 1) * limit)
      .exec();

    // Calculate total pages
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
// const updateOrderStatusByAdmin = async (req, res) => {
//   try {

//     const { orderId, productSize, productColor, newStatus } = req.body;

//     // Validate required fields
//     if (!orderId || !productSize || !productColor || !newStatus) {
//       return res.status(400).json({
//         success: false,
//         message: "Missing required fields",
//         receivedData: req.body,
//       });
//     }

//     // Valid statuses
//     const validStatuses = [
//       "Placed",
//       "Shipped",
//       "Delivered",
//       "Returned",
//       "canceled",
//     ];
//     if (!validStatuses.includes(newStatus)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid status provided",
//       });
//     }

//     // Find the order (admin can access any order)
//     const order = await Order.findById(orderId);

//     if (!order) {
//       return res.status(404).json({
//         success: false,
//         message: "Order not found",
//       });
//     }

//     // Find the specific item in the order using size and color
//     const orderItemIndex = order.items.findIndex((item) => {
//       // Add null checks
//       if (!item.variant) return false;

//       // Convert sizes and colors to uppercase for case-insensitive comparison
//       const itemSize = item.variant.size.toUpperCase();
//       const requestSize = productSize.toUpperCase();

//       const itemColor = item.variant.color.toUpperCase();
//       const requestColor = productColor.toUpperCase();

//       return itemSize === requestSize && itemColor === requestColor;
//     });

//     if (orderItemIndex === -1) {
//       return res.status(404).json({
//         success: false,
//         message: "Product not found in order",
//         debug: {
//           receivedData: {
//             size: productSize,
//             color: productColor,
//           },
//           availableItems: order.items.map((item) => ({
//             variant: item.variant,
//           })),
//         },
//       });
//     }

//     const orderItem = order.items[orderItemIndex];

//     // Update the status of the specific order item
//     order.items[orderItemIndex].orderStatus = newStatus;

//     // If all items in the order have the same status, update the overall order status
//     const allItemsSameStatus = order.items.every(
//       (item) => item.orderStatus === newStatus
//     );
//     if (allItemsSameStatus) {
//       order.orderStatus = newStatus;
//     }

//     await order.save();

//     res.json({
//       success: true,
//       message: `Order item status updated to ${newStatus} successfully`,
//       updatedOrder: order,
//     });
//   } catch (error) {
//     console.error("Admin order status update error:", error);
//     res.status(500).json({
//       success: false,
//       message: error.message || "Error updating order status",
//       receivedData: req.body,
//     });
//   }
// };
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
    ];
    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status provided",
      });
    }

    // Find the order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Find the specific item in the order using size and color
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

    if (orderItem.orderStatus === newStatus) {
      return res.status(400).json({
        success: false,
        message: `This item is already marked as ${newStatus}`,
      });
    }

    // Get the productId from the orderItem
    const productIdFromOrder = orderItem.productId;

    // Update product stock for "Returned" status
    if (newStatus === "Returned") {
      const product = await Product.findById(productIdFromOrder);
      if (product) {
        const variantIndex = product.variants.findIndex(
          (v) =>
            v.size.toUpperCase() === productSize.toUpperCase() &&
            v.color.toUpperCase() === productColor.toUpperCase()
        );

        if (variantIndex !== -1) {
          product.variants[variantIndex].quantity += orderItem.quantity; // Increment stock
          await product.save();
        }
      }
    }

    // Update the order item status
    order.items[orderItemIndex].orderStatus = newStatus;

    // If all items have the same status, update the overall order status
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


const loadOrderDetails = async (req, res) => {
  if (req.session.admin) {
    try {
      const orderId = req.params.id;
      const itemId = req.query.itemId; // Get from query parameter

      const order = await Order.findById(orderId)
        .populate("userId", "name email")
        .populate("shippingAddress");

      if (!order) {
        return res.redirect("/admin/pageerror");
      }

      // Find the specific item in the order items array
      const orderItem = order.items.find(
        (item) => item._id.toString() === itemId
      );

      if (!orderItem) {
        return res.redirect("/admin/pageerror");
      }

      res.render("orderDetails", {
        order,
        orderItem, // Pass the single item
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
