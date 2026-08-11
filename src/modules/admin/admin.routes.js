const express = require("express");
const router = express.Router();
const adminController = require("./adminController");
const { adminAuth } = require("../../shared/middlewares/auth");

router.get("/pageerror", adminController.pageerror);
router.get("/login", adminController.loadLogin);
router.post("/login", adminController.login);
router.get("/dashboard", adminAuth, adminController.loadDashboard);
router.post("/logout", adminAuth, adminController.logout);

//order management
router.get("/orderlist", adminAuth, adminController.loadOrderlist);
router.get("/orderDetails/:id", adminAuth, adminController.loadOrderDetails);
router.post(
  "/update-status",
  adminAuth,
  adminController.updateOrderStatusByAdmin
);

module.exports = router;
