const express = require("express");
const router = express.Router();
const couponController = require("./couponController");
const { adminAuth } = require("../../shared/middlewares/auth");

router.get(
  "/coupon-management",
  adminAuth,
  couponController.loadCouponManagement
);
router.get("/get-coupons", adminAuth, couponController.getCoupons);
router.post("/add-coupon", adminAuth, couponController.addCoupon);
router.delete("/coupons/:id", adminAuth, couponController.deleteCoupon);
router.get("/edit-coupon/:id", adminAuth, couponController.editCoupon);
router.post("/edit-coupon/:id", adminAuth, couponController.updateCoupon);

module.exports = router;
