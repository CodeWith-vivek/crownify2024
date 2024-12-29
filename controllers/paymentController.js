
const User = require("../models/userSchema");
const Product=require("../models/productSchema")

const Order = require("../models/orderSchema");
const Cart=require("../models/cartSchema")
const Razorpay = require("razorpay");
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

//code to load payment Success page

const loadPayment = async (req, res) => {
  try {
    const user = req.session.user;
    const { orderId } = req.query;

    const order = await Order.findOne({ _id: orderId })
      .populate({
        path: "items.productId",
        strictPopulate: false,
      })
      .populate({
        path: "shippingAddress",
        strictPopulate: false,
      })
      .exec();

    if (!order) {
      return res.status(404).send("Order not found");
    }

    const userData = user ? await User.findById(user) : null;

    return res.render("paymentSuccess", {
      user: userData,
      order, 
    });
  } catch (error) {
    console.error("Error loading payment success page:", error);
    res.status(500).send("Server error");
  }
};

//code to load payment failure page

const loadFailure = async (req, res) => {
  try {
    const user = req.session.user;
    const { orderId } = req.query;

    const order = await Order.findOne({ _id: orderId })
      .populate({
        path: "items.productId",
        strictPopulate: false,
      })
      .populate({
        path: "shippingAddress",
        strictPopulate: false,
      })
      .exec();

    if (!order) {
      return res.status(404).send("Order not found");
    }

    const userData = user ? await User.findById(user) : null;

    return res.render("paymentFailure", {
      user: userData,
      order, 
    });
  } catch (error) {
    console.error("Error loading payment success page:", error);
    res.status(500).send("Server error");
  }
};

//code for payment failure case


const paymentFailure = async (req, res) => {
  const { orderId, paymentId, razorpayOrderId, reason, description } = req.body;

  try {
    const order = await Order.findById(orderId);
    if (order) {
      // Find the user to update their cart array
      const user = await User.findById(order.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found.",
        });
      }

      // Find the cart to get its ID before deletion
      const cart = await Cart.findOne({ userId: order.userId });

      // Update order status
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

      if (cart) {
        // Remove cart from user's cart array
        user.cart = user.cart.filter((cartId) => !cartId.equals(cart._id));
        await user.save();
      }

      req.session.coupon = null;
      await Cart.deleteOne({ userId: order.userId });

      return res.status(200).json({
        success: true,
        message: "Payment failure recorded and cart deleted.",
      });
    } else {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }
  } catch (error) {
    console.error("DEBUG: Error handling payment failure:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

//code for retry payment

const retryPayment = async (req, res) => {
  try {
  
    const { orderId } = req.body;

    if (!orderId) {
      return res
        .status(400)
        .json({ success: false, message: "orderId is required" });
    }

    const existingOrder = await Order.findOne({
      orderNumber: orderId,
    }).populate("items.productId"); 
    if (!existingOrder) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (!existingOrder.grandTotal || existingOrder.grandTotal <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid order amount" });
    }

  
    for (const item of existingOrder.items) {
      const product = await Product.findById(item.productId); 
      if (product) {
        const variantIndex = product.variants.findIndex(
          (v) => v.size === item.variant.size && v.color === item.variant.color
        );

        if (variantIndex !== -1) {
          if (product.variants[variantIndex].quantity < item.quantity) {
            return res.status(400).json({
              success: false,
              message: `Insufficient stock for ${product.productName}. Available: ${product.variants[variantIndex].quantity}, Requested: ${item.quantity}`,
            });
          }
        } else {
          return res.status(400).json({
            success: false,
            message: `Variant not found for product ${product.productName}`,
          });
        }
      } else {
        return res.status(404).json({
          success: false,
          message: `Product not found for item ${item.productId}`,
        });
      }
    }

    const amountInPaise = Math.round(existingOrder.grandTotal * 100);


    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise, 
      currency: "INR",
      receipt: `retry_${existingOrder.orderNumber}`, 
    });

    existingOrder.razorpayOrderId = razorpayOrder.id;


    await existingOrder.save();
  
    res.json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID, 
      amount: razorpayOrder.amount, 
      orderId: razorpayOrder.id, 
      orderNumber: existingOrder.orderNumber,
    });
  } catch (error) {
    console.error("Error in retry payment:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

//cod to update order status

const updateOrderStatus = async (req, res) => {
  try {
    const { orderNumber, paymentId, items } = req.body; 

    if (!orderNumber || !paymentId || !items) {
      return res.status(400).json({
        success: false,
        message: "orderNumber, paymentId, and items are required",
      });
    }

    const existingOrder = await Order.findOne({ orderNumber: orderNumber });
    if (!existingOrder) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    existingOrder.paymentStatus = "Completed";
    existingOrder.items.forEach((item) => {
      item.orderStatus = "Placed";
    });

    await existingOrder.save();

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (product) {
        const variantIndex = product.variants.findIndex(
          (v) => v.size === item.variant.size && v.color === item.variant.color
        );

        if (variantIndex !== -1) {

          product.variants[variantIndex].quantity -= item.quantity; 
          await product.save();

        } else {
          console.error(
            "Variant not found for product:",
            product.productName
          );
        }
      } else {
        console.error("Product not found for item:", item);
      }
    }

    res.json({ success: true, message: "Order status updated successfully" });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

//code to get orderDetails

const getOrderDetails=async(req,res)=>{
  try {
    const { orderNumber } = req.params;
    const order = await Order.findOne({ orderNumber }).populate(
      "items.productId"
    ); 

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    res.json({ success: true, order });
  } catch (error) {
    console.error("Error fetching order details:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}

module.exports = {
  loadPayment,
  loadFailure,
  paymentFailure,
  retryPayment,
  updateOrderStatus,
  getOrderDetails
};