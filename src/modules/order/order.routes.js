const express = require("express");
const router = express.Router();
const orderController = require("./orderController");
const { userAuth } = require("../../shared/middlewares/auth");

router.post("/cancel-item", userAuth, orderController.cancelOrder);
router.post("/return-item", userAuth, orderController.returnItem);
router.post("/cancel-return-request", userAuth, orderController.cancelReturn);

router.post("/checkout", userAuth, orderController.placeOrder);
router.post("/verify-payment", userAuth, orderController.verifyRazorpayPayment);

router.post(
  "/delete-preliminary-order",
  userAuth,
  orderController.deletepremilinaryOrder
);

module.exports = router;
