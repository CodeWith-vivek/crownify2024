// Barrel for the coupon module — split into admin CRUD and the
// customer-facing apply/remove flow; keeps the existing
// `couponController.x` call sites in coupon.routes.js and
// coupon.admin.routes.js working unchanged.
const {
  loadCouponManagement,
  getCoupons,
  addCoupon,
  deleteCoupon,
  editCoupon,
  updateCoupon,
} = require("./couponAdmin.controller");
const { couponApply, removeCoupon } = require("./couponApply.controller");

module.exports = {
  loadCouponManagement,
  getCoupons,
  addCoupon,
  deleteCoupon,
  editCoupon,
  updateCoupon,
  couponApply,
  removeCoupon,
};
