// Barrel for the admin module — split into admin session handling and
// admin order management; keeps the existing `adminController.x` call
// sites in admin.routes.js working unchanged.
const {
  pageerror,
  loadLogin,
  getCurrentAdmin,
  login,
  loadDashboard,
  logout,
} = require("./adminAuth.controller");
const {
  loadOrderlist,
  loadOrderDetails,
  updateOrderStatusByAdmin,
} = require("./adminOrders.controller");

module.exports = {
  loadLogin,
  getCurrentAdmin,
  login,
  loadDashboard,
  pageerror,
  logout,
  loadOrderlist,
  loadOrderDetails,
  updateOrderStatusByAdmin,
};
