const checkoutService = require("./checkout.service");
const { sendError } = require("../../shared/errors/respond");

// HTTP adapter only — rules live in checkout.service.js.

const loadCheckout = async (req, res) => {
  try {
    const { clearSessionCoupon, result } = await checkoutService.getCheckoutPage({
      userId: req.session.user,
      sessionCoupon: req.session.coupon,
    });

    // Cleared before responding, not after: express-session persists on
    // response end, so a mutation after res.json() races the save. The
    // coupon value is already captured in `result`.
    if (clearSessionCoupon) req.session.coupon = null;

    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error on loading checkout");
  }
};

const validateQuantity = async (req, res) => {
  try {
    const result = await checkoutService.validateCartForCheckout(req.session.user);
    return res.json(result);
  } catch (error) {
    return sendError(res, error, "Error during checkout validation");
  }
};

module.exports = { loadCheckout, validateQuantity };
