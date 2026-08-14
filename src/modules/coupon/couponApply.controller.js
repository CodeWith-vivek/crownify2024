const couponService = require("./coupon.service");
const { sendError } = require("../../shared/errors/respond");

// HTTP adapter for customer-facing coupon application at checkout. Rules
// live in coupon.service.js; the session is written here.

const couponApply = async (req, res) => {
  try {
    const { result, sessionCoupon } = await couponService.applyCoupon({
      userId: req.session.user,
      couponCode: req.body.couponCode,
      cartTotal: req.body.cartTotal,
    });

    req.session.coupon = sessionCoupon;

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    // Most rejections also clear whatever was already applied; the service
    // flags which ones.
    if (error.meta?.clearSessionCoupon) req.session.coupon = null;
    return sendError(res, error, "Error in couponApply");
  }
};

const removeCoupon = async (req, res) => {
  try {
    const result = couponService.removeCoupon({ cartTotal: req.body.cartTotal });

    req.session.coupon = null;

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error removing coupon");
  }
};

module.exports = { couponApply, removeCoupon };
