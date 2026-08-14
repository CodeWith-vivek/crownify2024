const customerService = require("./customer.service");
const { sendError } = require("../../shared/errors/respond");

// HTTP adapters for admin customer management. Rules live in
// customer.service.js.

const customerInfo = async (req, res) => {
  try {
    const result = await customerService.listCustomers({
      search: req.query.search || "",
      page: parseInt(req.query.page) || 1,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error loading customer info");
  }
};

const customerBlocked = async (req, res) => {
  try {
    const result = await customerService.setCustomerBlocked({
      customerId: req.query.id,
      isBlocked: true,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Could not block customer");
  }
};

const customerUnblocked = async (req, res) => {
  try {
    const result = await customerService.setCustomerBlocked({
      customerId: req.query.id,
      isBlocked: false,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Could not unblock customer");
  }
};

module.exports = { customerInfo, customerBlocked, customerUnblocked };
