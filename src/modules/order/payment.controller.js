const paymentService = require("./payment.service");
const { sendError } = require("../../shared/errors/respond");

// HTTP adapter for RazorPay verification. Rules live in payment.service.js.

const verifyRazorpayPayment = async (req, res) => {
  try {
    const { clearSessionCoupon, result } = await paymentService.confirmRazorpayPayment({
      userId: req.session.user,
      orderId: req.body.orderId,
      razorpay_order_id: req.body.razorpay_order_id,
      razorpay_payment_id: req.body.razorpay_payment_id,
      razorpay_signature: req.body.razorpay_signature,
    });

    if (clearSessionCoupon) req.session.coupon = null;

    return res.json({ success: true, ...result });
  } catch (error) {
    // An unexpected failure mid-verification leaves the order in limbo,
    // so record it as Failed before responding. Expected failures (bad
    // signature, missing order) already set their own state in the
    // service and must not be overwritten here.
    if (!error.isAppError) {
      await paymentService.markPaymentFailed({
        userId: req.session.user,
        orderId: req.body.orderId,
        razorpayOrderId: req.body.razorpay_order_id,
        reason: error.message,
      });
    }

    return sendError(res, error, "Payment verification error");
  }
};

module.exports = { verifyRazorpayPayment };
