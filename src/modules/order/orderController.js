// Barrel for the order module. This file used to BE the module — a single
// 953-line controller in which placeOrder alone was 421 lines. It's now
// split by concern into the files below; this barrel keeps the existing
// `orderController.x` call sites in order.routes.js working unchanged.
const { placeOrder, deletepremilinaryOrder } = require("./placeOrder.controller");
const { cancelOrder, returnItem, cancelReturn } = require("./orderModification.controller");
const { verifyRazorpayPayment } = require("./payment.controller");

module.exports = {
  placeOrder,
  cancelOrder,
  returnItem,
  verifyRazorpayPayment,
  cancelReturn,
  deletepremilinaryOrder,
};
