const express = require("express");
const router = express.Router();
const customerController = require("./customerController");
const { adminAuth } = require("../../shared/middlewares/auth");

router.get("/users", adminAuth, customerController.customerInfo);
router.get("/blockCustomer", adminAuth, customerController.customerBlocked);
router.get(
  "/unblockCustomer",
  adminAuth,
  customerController.customerUnblocked
);

module.exports = router;
