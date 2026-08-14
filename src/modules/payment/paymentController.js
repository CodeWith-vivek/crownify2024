const paymentService = require("./payment.service");
const { sendError } = require("../../shared/errors/respond");

// HTTP adapters for the post-checkout payment screens and actions. Rules
// live in payment.service.js. Every route here is behind userAuth, so
// req.session.user is always a live account — which is what lets the
// service scope every order lookup to its owner.

const loadPayment = async (req, res) => {
  try {
    const result = await paymentService.getOrderForReceipt({
      userId: req.session.user,
      orderId: req.query.orderId,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error loading payment success page");
  }
};

const loadFailure = async (req, res) => {
  try {
    const result = await paymentService.getOrderForReceipt({
      userId: req.session.user,
      orderId: req.query.orderId,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error loading payment failure page");
  }
};

const paymentFailure = async (req, res) => {
  try {
    const { clearSessionCoupon, result } = await paymentService.recordPaymentFailure({
      userId: req.session.user,
      orderId: req.body.orderId,
      paymentId: req.body.paymentId,
      razorpayOrderId: req.body.razorpayOrderId,
      reason: req.body.reason,
      description: req.body.description,
    });

    if (clearSessionCoupon) req.session.coupon = null;

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error handling payment failure");
  }
};

const retryPayment = async (req, res) => {
  try {
    const result = await paymentService.retryPayment({
      userId: req.session.user,
      // The client posts the order NUMBER under the name `orderId`.
      orderNumber: req.body.orderId,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error in retry payment");
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const result = await paymentService.confirmRetriedPayment({
      userId: req.session.user,
      orderNumber: req.body.orderNumber,
      paymentId: req.body.paymentId,
      razorpayOrderId: req.body.razorpayOrderId,
      razorpaySignature: req.body.razorpaySignature,
      items: req.body.items,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error updating order status");
  }
};

const getOrderDetails = async (req, res) => {
  try {
    const order = await paymentService.getOrderByNumber({
      userId: req.session.user,
      orderNumber: req.params.orderNumber,
    });
    return res.json({ success: true, order });
  } catch (error) {
    return sendError(res, error, "Error fetching order details");
  }
};

module.exports = {
  loadPayment,
  loadFailure,
  paymentFailure,
  retryPayment,
  updateOrderStatus,
  getOrderDetails,
};
