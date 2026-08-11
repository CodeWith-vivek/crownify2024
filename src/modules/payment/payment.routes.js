const express = require("express");
const router = express.Router();
const paymentController = require("./paymentController");
const { userAuth } = require("../../shared/middlewares/auth");

router.get("/payment-Success", userAuth, paymentController.loadPayment);
router.get("/payment-Failure", userAuth, paymentController.loadFailure);
router.post("/payment-failure", userAuth, paymentController.paymentFailure);
router.post("/retry-payment", userAuth, paymentController.retryPayment);

router.post(
  "/update-order-status",
  userAuth,
  paymentController.updateOrderStatus
);
router.get(
  "/get-order-details/:orderNumber",
  userAuth,
  paymentController.getOrderDetails
);

module.exports = router;
