const crypto = require("crypto");
const Order = require("./orderSchema");
const Cart = require("../cart/cartSchema");
const Coupon = require("../coupon/couponSchema");
const User = require("../user/userSchema");
const { recordCouponUsage, clearCartAfterOrder } = require("./helpers/checkout");
const { decrementStockForItems } = require("./helpers/orderItems");

// RazorPay payment verification. placeOrder only creates a Pending
// "preliminary" order for RazorPay and deliberately defers every side
// effect (stock, coupon usage, cart teardown) to here — none of it should
// happen until the payment signature actually verifies.

const verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const isSignatureValid = generatedSignature === razorpay_signature;

    // Scoped to the session user so a caller can't drive the payment-status
    // update against an order they don't own by passing someone else's id.
    const order = await Order.findOne({ _id: orderId, userId: req.session.user });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (!isSignatureValid) {
      order.paymentStatus = "Failed";
      order.paymentDetails = {
        razorpayOrderId: razorpay_order_id,
        paymentStatus: "Signature Invalid",
        failureReason: "Invalid payment signature",
        paymentDate: new Date(),
      };

      await order.save();

      return res.status(400).json({
        success: false,
        message: "Invalid payment signature. Payment failed.",
      });
    }

    const user = await User.findById(order.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (order.couponCode) {
      const coupon = await Coupon.findOne({ code: order.couponCode });
      await recordCouponUsage(coupon, order.userId);
    }

    await decrementStockForItems(order.items);

    order.paymentStatus = "Completed";
    order.paymentDetails = {
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      paymentDate: new Date(),
    };

    await order.save();

    const cart = await Cart.findOne({ userId: order.userId });
    await clearCartAfterOrder(user, cart, req);

    res.json({
      success: true,
      message: "Payment successful",
      orderId: order._id,
    });
  } catch (error) {
    console.error("Payment verification error:", error);

    if (req.body.orderId) {
      // Same scoping as the success path — otherwise this error branch would
      // let a caller mark an arbitrary order as Failed.
      const order = await Order.findOne({
        _id: req.body.orderId,
        userId: req.session.user,
      });
      if (order) {
        order.paymentStatus = "Failed";
        order.paymentDetails = {
          razorpayOrderId: req.body.razorpay_order_id,
          paymentStatus: "Error During Verification",
          failureReason: error.message || "Unknown error",
          paymentDate: new Date(),
        };
        await order.save();
      }
    }

    res.status(500).json({ success: false, message: "Error verifying payment" });
  }
};

module.exports = { verifyRazorpayPayment };
