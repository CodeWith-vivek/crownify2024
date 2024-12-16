
const User = require("../models/userSchema");

const Order = require("../models/orderSchema");

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

module.exports = {
  loadPayment,
  loadFailure
};