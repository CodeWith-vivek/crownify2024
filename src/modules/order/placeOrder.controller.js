const orderService = require("./order.service");
const { sendError } = require("../../shared/errors/respond");

// HTTP adapter only. Everything these do is: pull values off the request,
// hand them to the service, then translate the outcome into a response.
// No business rules live here — see order.service.js.

const placeOrder = async (req, res) => {
  try {
    const { clearSessionCoupon, result } = await orderService.placeOrder({
      userId: req.session.user,
      primaryAddressId: req.body.primaryAddressId,
      subtotal: req.body.subtotal,
      shipping: req.body.shipping,
      paymentMethod: req.body.paymentMethod,
      sessionCoupon: req.session.coupon,
    });

    // Session mutation is the controller's job — the service only reports
    // whether it should happen.
    if (clearSessionCoupon) req.session.coupon = null;

    return res.json({ success: true, ...result });
  } catch (error) {
    if (error.meta?.clearSessionCoupon) req.session.coupon = null;
    return sendError(res, error, "Error placing order");
  }
};

const deletepremilinaryOrder = async (req, res) => {
  try {
    const result = await orderService.deletePreliminaryOrder({
      userId: req.session.user,
      orderId: req.body.orderId,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error deleting preliminary order");
  }
};

module.exports = { placeOrder, deletepremilinaryOrder };
