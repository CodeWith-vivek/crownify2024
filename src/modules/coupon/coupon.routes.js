const express = require("express");
const router = express.Router();
const couponController = require("./couponController");
const { userAuth } = require("../../shared/middlewares/auth");

router.post("/apply-coupon", userAuth, couponController.couponApply);
router.post("/remove-coupon", userAuth, couponController.removeCoupon);

module.exports = router;
