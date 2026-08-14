// Barrel for the report module. This file used to BE the module — a single
// 1394-line controller mixing six unrelated concerns (JSON stats, Excel
// export, three different PDF documents, and their shared drawing
// primitives). It's now split by concern into the files below; this barrel
// keeps the existing `reportController.x` call sites in report.routes.js /
// report.admin.routes.js working unchanged.
const { generateSalesReport, salesChart } = require("./salesReport.controller");
const {
  getOverallRevenue,
  getTotalOrders,
  getTotalProducts,
  getTotalCategories,
} = require("./dashboardStats.controller");
const { downloadExcel } = require("./excelExport.controller");
const { reportPdf } = require("./salesReportPdf.controller");
const { generateInvoicePDF } = require("./invoicePdf.controller");
const { generateCreditNotePDF } = require("./creditNotePdf.controller");

module.exports = {
  generateSalesReport,
  reportPdf,
  salesChart,
  getOverallRevenue,
  getTotalOrders,
  getTotalProducts,
  getTotalCategories,
  generateInvoicePDF,
  generateCreditNotePDF,
  downloadExcel,
};
