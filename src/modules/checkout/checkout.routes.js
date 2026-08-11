const express = require("express");
const router = express.Router();
const checkoutController = require("./checkoutController");
const { userAuth } = require("../../shared/middlewares/auth");
const rollbackCoupon = require("../../shared/middlewares/rollbackCoupon");

router.get(
  "/checkout",
  userAuth,
  (req, res, next) => {
    req.session.isCheckoutPage = true;
    next();
  },
  rollbackCoupon,
  checkoutController.loadCheckout
);
router.post(
  "/checkout/validate",
  userAuth,
  checkoutController.validateQuantity
);

module.exports = router;
