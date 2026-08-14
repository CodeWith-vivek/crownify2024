const Coupon = require("./couponSchema");

// Customer-facing coupon application at checkout.
//
// Applying a coupon only stashes it on the session as `temporary` — it is
// NOT recorded against the coupon's usage count here. That happens at
// order placement (order/helpers/checkout.js recordCouponUsage), so
// abandoning a checkout after applying a code doesn't burn the customer's
// one allowed use.

const couponApply = async (req, res) => {
  const { couponCode, cartTotal } = req.body;
  const userId = req.session.user;

  try {
    if (!couponCode || !cartTotal || cartTotal <= 0) {
      req.session.coupon = null;
      return res.status(400).json({ success: false, message: "Invalid input." });
    }

    const coupon = await Coupon.findOne({ code: couponCode, isActive: true });
    if (!coupon) {
      req.session.coupon = null;
      return res.status(400).json({ success: false, message: "Invalid or expired coupon." });
    }

    if (new Date() > coupon.expiryDate) {
      req.session.coupon = null;
      return res.status(400).json({ success: false, message: "This coupon has expired." });
    }

    if (cartTotal < coupon.minPurchase) {
      req.session.coupon = null;
      return res.status(400).json({
        success: false,
        message: `Minimum purchase required is ₹${coupon.minPurchase}.`,
      });
    }

    if (!Array.isArray(coupon.users_applied)) {
      coupon.users_applied = [];
    }

    const userEntry = coupon.users_applied.find(
      (entry) => entry.user && entry.user.toString() === userId.toString()
    );

    // usageLimit 0 means unlimited.
    if (coupon.usageLimit !== 0 && userEntry && userEntry.used_count >= coupon.usageLimit) {
      return res.status(400).json({
        success: false,
        message: "You have reached the usage limit for this coupon.",
      });
    }

    let discount = 0;
    if (coupon.discountType === "percentage") {
      discount = Math.floor((cartTotal * coupon.discountAmount) / 100);
      discount = Math.min(discount, coupon.maxDiscount || discount);
    } else if (coupon.discountType === "fixed") {
      discount = Math.floor(coupon.discountAmount);
    }

    const finalTotal = Math.floor(Math.max(0, cartTotal - discount));

    req.session.coupon = {
      code: coupon.code,
      discount: {
        originalAmount: coupon.discountAmount,
        calculatedAmount: discount,
        type: coupon.discountType,
      },
      maxDiscount: coupon.maxDiscount,
      cartTotal,
      userId,
      // Marks it as applied-but-not-yet-committed; placeOrder re-validates
      // and only then records the usage.
      temporary: true,
    };

    return res.status(200).json({
      success: true,
      discount: { percentageOrFixed: coupon.discountAmount, applied: discount },
      finalTotal,
    });
  } catch (err) {
    console.error("Error in couponApply:", err);
    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
};

const removeCoupon = async (req, res) => {
  const { cartTotal } = req.body;

  try {
    if (cartTotal < 0) {
      return res.status(400).json({ success: false, message: "Invalid input." });
    }

    req.session.coupon = null;

    return res.status(200).json({
      success: true,
      message: "Coupon removed successfully.",
      discount: 0,
      finalTotal: cartTotal,
    });
  } catch (err) {
    console.error("Error removing coupon:", err);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while removing the coupon.",
    });
  }
};

module.exports = { couponApply, removeCoupon };
