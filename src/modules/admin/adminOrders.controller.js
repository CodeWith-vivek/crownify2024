const adminOrdersService = require("./adminOrders.service");
const { sendError } = require("../../shared/errors/respond");

// HTTP adapters for admin order management. Rules live in
// adminOrders.service.js. Every route here is behind adminAuth, so the
// `if (!req.session.admin)` check loadOrderDetails used to carry was
// unreachable.

const loadOrderlist = async (req, res) => {
  try {
    const result = await adminOrdersService.listOrders({
      page: parseInt(req.query.page) || 1,
      search: req.query.search ? req.query.search.trim() : "",
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error loading orders");
  }
};

const loadOrderDetails = async (req, res) => {
  try {
    const result = await adminOrdersService.getOrderDetails({
      orderId: req.params.id,
      itemId: req.query.itemId,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error loading order details");
  }
};

const updateOrderStatusByAdmin = async (req, res) => {
  try {
    const result = await adminOrdersService.updateOrderItemStatus({
      orderId: req.body.orderId,
      productSize: req.body.productSize,
      productColor: req.body.productColor,
      newStatus: req.body.newStatus,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Admin order status update error");
  }
};

module.exports = { loadOrderlist, loadOrderDetails, updateOrderStatusByAdmin };
