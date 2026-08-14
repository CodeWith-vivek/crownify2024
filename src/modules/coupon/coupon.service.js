const Coupon = require("./couponSchema");
const { notFound, badRequest } = require("../../shared/errors/AppError");

// Coupon rules, free of Express.
//
// Applying a coupon only produces a `temporary` session payload — it is
// NOT recorded against the coupon's usage count here. That happens at
// order placement (order/helpers/checkout.js recordCouponUsage), so
// abandoning a checkout after applying a code doesn't burn the customer's
// one allowed use.

// A usage limit of 0 means unlimited.
const UNLIMITED = 0;

/** Every rejection except one also drops whatever is on the session. */
const reject = (message) => badRequest(message, { clearSessionCoupon: true });

function calculateDiscount(coupon, cartTotal) {
  if (coupon.discountType === "percentage") {
    const raw = Math.floor((cartTotal * coupon.discountAmount) / 100);
    return Math.min(raw, coupon.maxDiscount || raw);
  }

  if (coupon.discountType === "fixed") {
    return Math.floor(coupon.discountAmount);
  }

  return 0;
}

function hasExhaustedLimit(coupon, userId) {
  if (coupon.usageLimit === UNLIMITED) return false;

  const entry = (coupon.users_applied || []).find(
    (applied) => applied.user && applied.user.toString() === userId.toString()
  );

  return Boolean(entry && entry.used_count >= coupon.usageLimit);
}

/**
 * @returns {{result, sessionCoupon}} the controller writes `sessionCoupon`
 *   onto the session; the service never touches it.
 */
async function applyCoupon({ userId, couponCode, cartTotal }) {
  if (!couponCode || !cartTotal || cartTotal <= 0) throw reject("Invalid input.");

  const coupon = await Coupon.findOne({ code: couponCode, isActive: true });
  if (!coupon) throw reject("Invalid or expired coupon.");

  if (new Date() > coupon.expiryDate) throw reject("This coupon has expired.");

  if (cartTotal < coupon.minPurchase) {
    throw reject(`Minimum purchase required is ₹${coupon.minPurchase}.`);
  }

  // Deliberately not a `reject`: hitting your own usage limit leaves any
  // previously applied coupon in place rather than silently clearing it.
  if (hasExhaustedLimit(coupon, userId)) {
    throw badRequest("You have reached the usage limit for this coupon.");
  }

  const discount = calculateDiscount(coupon, cartTotal);

  return {
    result: {
      discount: { percentageOrFixed: coupon.discountAmount, applied: discount },
      finalTotal: Math.floor(Math.max(0, cartTotal - discount)),
    },
    sessionCoupon: {
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
    },
  };
}

function removeCoupon({ cartTotal }) {
  if (cartTotal < 0) throw badRequest("Invalid input.");

  return { message: "Coupon removed successfully.", discount: 0, finalTotal: cartTotal };
}

const listCoupons = () => Coupon.find({}).sort({ createdAt: -1 });

async function createCoupon(body) {
  if (await Coupon.findOne({ code: body.code })) {
    throw badRequest("Coupon code already exists");
  }

  if (body.usageLimit < 0) throw badRequest("Usage limit must be 0 or greater.");

  const coupon = await new Coupon({
    code: body.code,
    discountType: body.discountType,
    discountAmount: Number(body.discountAmount),
    maxDiscount: Number(body.maxDiscount),
    minPurchase: Number(body.minPurchase),
    expiryDate: new Date(body.expiryDate),
    usageLimit: Number(body.usageLimit),
    description: body.description ? body.description.trim() : undefined,
  }).save();

  return { message: "Coupon added successfully!", coupon };
}

async function getCoupon(couponId) {
  const coupon = await Coupon.findById(couponId);
  if (!coupon) throw notFound("Coupon not found");
  return coupon;
}

async function updateCoupon({ couponId, body }) {
  const updated = await Coupon.findByIdAndUpdate(
    couponId,
    {
      // The edit form posts the code as `couponCode`; the schema calls it
      // `code`.
      code: body.couponCode,
      discountType: body.discountType,
      discountAmount: body.discountAmount,
      maxDiscount: body.maxDiscount,
      minPurchase: body.minPurchase,
      expiryDate: body.expiryDate,
      usageLimit: body.usageLimit,
      description: body.description,
    },
    { new: true, runValidators: true }
  );

  if (!updated) throw notFound("Coupon not found");

  return { message: "Coupon updated successfully" };
}

async function deleteCoupon(couponId) {
  const deleted = await Coupon.findByIdAndDelete(couponId);
  if (!deleted) throw notFound("Coupon not found");

  return { message: "Coupon deleted successfully!" };
}

module.exports = {
  applyCoupon,
  removeCoupon,
  listCoupons,
  createCoupon,
  getCoupon,
  updateCoupon,
  deleteCoupon,
  calculateDiscount,
  hasExhaustedLimit,
};
