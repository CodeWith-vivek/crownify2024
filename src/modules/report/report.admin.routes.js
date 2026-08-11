const express = require("express");
const router = express.Router();
const reportController = require("./reportController");
const { adminAuth } = require("../../shared/middlewares/auth");

router.post("/sales-report", adminAuth, reportController.generateSalesReport);
router.post("/sales-chart", adminAuth, reportController.salesChart);
router.post("/sales-report/pdf", adminAuth, reportController.reportPdf);
router.get("/overall-revenue", adminAuth, reportController.getOverallRevenue);
router.get("/total-orders", adminAuth, reportController.getTotalOrders);
router.get("/total-products", adminAuth, reportController.getTotalProducts);
router.get(
  "/total-categories",
  adminAuth,
  reportController.getTotalCategories
);
router.post(
  "/sales-report/excel",
  adminAuth,
  reportController.downloadExcel
);

module.exports = router;
