const express = require("express");
const router = express.Router();
const topsellingController = require("./topsellingController");
const { adminAuth } = require("../../shared/middlewares/auth");

router.get(
  "/top-selling-stats",
  adminAuth,
  topsellingController.getTopSellingStats
);

module.exports = router;
