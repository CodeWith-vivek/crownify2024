const orderService = require("./order.service");
const { sendError } = require("../../shared/errors/respond");

// HTTP adapters for customer-initiated changes to an existing order.
// Business rules live in order.service.js.

const cancelOrder = async (req, res) => {
  try {
    const result = await orderService.cancelOrderItem({
      userId: req.session.user,
      orderNumber: req.body.orderNumber,
      productSize: req.body.productSize,
      productColor: req.body.productColor,
      cancelComment: req.body.cancelComment,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Cancel product error");
  }
};

const returnItem = async (req, res) => {
  try {
    const result = await orderService.requestReturn({
      userId: req.session.user,
      orderNumber: req.body.orderNumber,
      productSize: req.body.productSize,
      productColor: req.body.productColor,
      returnComment: req.body.returnComment,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Return request error");
  }
};

const cancelReturn = async (req, res) => {
  try {
    const result = await orderService.cancelReturnRequest({
      userId: req.session.user,
      orderNumber: req.body.orderNumber,
      productSize: req.body.productSize,
      productColor: req.body.productColor,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error canceling return request");
  }
};

module.exports = { cancelOrder, returnItem, cancelReturn };
