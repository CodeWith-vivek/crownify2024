
const User = require("../models/userSchema");
const Product=require("../models/productSchema")

const Order = require("../models/orderSchema");
const Cart=require("../models/cartSchema")
const Razorpay = require("razorpay");
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});


const loadPayment = async (req, res) => {
  try {
    const user = req.session.user;
    const { orderId } = req.query;

    // Fetch the order and populate items.productId and shippingAddress
    const order = await Order.findOne({ _id: orderId })
      .populate({
        path: "items.productId", // Correct path for product reference
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

    // Fetch user data if logged in
    const userData = user ? await User.findById(user) : null;

    // Render the payment success page
    return res.render("paymentSuccess", {
      user: userData,
      order, // Pass the order object to the view
    });
  } catch (error) {
    console.error("Error loading payment success page:", error);
    res.status(500).send("Server error");
  }
};
const loadFailure = async (req, res) => {
  try {
    const user = req.session.user;
    const { orderId } = req.query;

    // Fetch the order and populate items.productId and shippingAddress
    const order = await Order.findOne({ _id: orderId })
      .populate({
        path: "items.productId", // Correct path for product reference
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

    // Fetch user data if logged in
    const userData = user ? await User.findById(user) : null;

    // Render the payment success page
    return res.render("paymentFailure", {
      user: userData,
      order, // Pass the order object to the view
    });
  } catch (error) {
    console.error("Error loading payment success page:", error);
    res.status(500).send("Server error");
  }
};
 const paymentFailure = async (req, res) => {
   const { orderId, paymentId, razorpayOrderId, reason, description } =
     req.body;

   try {
     // Update order in the database
     const order = await Order.findById(orderId);
     if (order) {
       // Mark the order as failed
       order.paymentStatus = "Failed";
       order.items.forEach((item) => {
         item.orderStatus = "Failed";
       });

       // Add payment failure details
       order.paymentDetails = {
         paymentId,
         razorpayOrderId,
         failureReason: reason,
         failureDescription: description,
         paymentDate: new Date(),
       };
       await order.save();

       // Delete the user's cart
        req.session.coupon = null;
       await Cart.deleteOne({ userId: order.userId });
       console.log("DEBUG: User cart deleted for userId:", order.userId);

       console.log("DEBUG: Order marked as failed:", order);
       return res
         .status(200)
         .json({
           success: true,
           message: "Payment failure recorded and cart deleted.",
         });
     } else {
       return res
         .status(404)
         .json({ success: false, message: "Order not found." });
     }
   } catch (error) {
     console.error("DEBUG: Error handling payment failure:", error);
     return res
       .status(500)
       .json({ success: false, message: "Internal server error." });
   }
 };

const retryPayment = async (req, res) => {
  try {
    console.log("DEBUG: Received retry payment request with body:", req.body);

    const { orderId } = req.body;

    if (!orderId) {
      console.error("DEBUG: Missing orderId in request body");
      return res
        .status(400)
        .json({ success: false, message: "orderId is required" });
    }

    // Check if the order exists in the database
    const existingOrder = await Order.findOne({ orderNumber: orderId });
    if (!existingOrder) {
      console.error("DEBUG: Order not found for orderNumber:", orderId);
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    console.log("DEBUG: Found order in database:", existingOrder);

    if (!existingOrder.grandTotal || existingOrder.grandTotal <= 0) {
      console.error("DEBUG: Invalid order amount:", existingOrder.grandTotal);
      return res
        .status(400)
        .json({ success: false, message: "Invalid order amount" });
    }

    const amountInPaise = Math.round(existingOrder.grandTotal * 100);
    console.log("DEBUG: Calculated amount in paise:", amountInPaise);

    // Create a new Razorpay order with the same amount and details
    console.log("DEBUG: Creating Razorpay order...");
    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise, // Razorpay expects amount in paise
      currency: "INR",
      receipt: `retry_${existingOrder.orderNumber}`, // Unique receipt identifier
    });

    console.log("DEBUG: Created Razorpay order:", razorpayOrder);

    // Update the order in the database with the new Razorpay order ID
    existingOrder.razorpayOrderId = razorpayOrder.id;
    existingOrder.paymentStatus = "Completed";
    existingOrder.items.forEach((item) => {
      item.orderStatus = "Placed";
    });

    // Update status to pending payment
    await existingOrder.save();

    // Reduce the stock quantity for each item in the order
    for (const item of existingOrder.items) {
      const product = await Product.findById(item.productId); // Assuming item has a productId
      if (product) {
        const variantIndex = product.variants.findIndex(
          (v) => v.size === item.variant.size && v.color === item.variant.color
        );

        if (variantIndex !== -1) {
          product.variants[variantIndex].quantity -= item.quantity; // Decrease stock by the ordered quantity
          await product.save(); // Save the updated product
          console.log(
            `DEBUG: Updated stock for product ${product._id}: ${product.variants[variantIndex].quantity}`
          );
        } else {
          console.error(
            "DEBUG: Variant not found for product:",
            product.productName
          );
        }
      } else {
        console.error("DEBUG: Product not found for item:", item);
      }
    }

    console.log(
      "DEBUG: Updated order in database with new Razorpay order ID:",
      existingOrder
    );

    // Respond with the new Razorpay order details
    res.json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID, // Razorpay API Key
      amount: razorpayOrder.amount, // Amount in paise
      orderId: razorpayOrder.id, // New Razorpay order ID
    });
  } catch (error) {
    console.error("Error in retry payment:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

module.exports = {
  loadPayment,
  loadFailure,
  paymentFailure,
  retryPayment
};