const express = require("express");
const router = express.Router();
const reportController = require("./reportController");
const { userAuth } = require("../../shared/middlewares/auth");

router.get(
  "/invoice/:orderId",
  userAuth,
  reportController.generateInvoicePDF
);

module.exports = router;
