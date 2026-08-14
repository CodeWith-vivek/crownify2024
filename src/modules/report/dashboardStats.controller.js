const reportService = require("./report.service");
const { sendError } = require("../../shared/errors/respond");

// HTTP adapters for the admin dashboard's stat cards. Each is its own
// request so a slow or failing one doesn't block the rest of the dashboard
// from rendering. Queries live in report.service.js.

const getOverallRevenue = async (req, res) => {
  try {
    const result = await reportService.getOverallRevenue();
    return res.json({ status: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error calculating overall revenue", { flag: "status" });
  }
};

/**
 * The three count cards differ only in which collection they count and
 * what the field is called, so they share one adapter.
 */
const countCard = (load, key, logLabel) => async (req, res) => {
  try {
    return res.json({ status: true, [key]: await load() });
  } catch (error) {
    return sendError(res, error, logLabel, { flag: "status" });
  }
};

const getTotalOrders = countCard(
  reportService.getTotalOrders,
  "totalOrders",
  "Error fetching total orders"
);

const getTotalProducts = countCard(
  reportService.getTotalProducts,
  "totalProducts",
  "Error fetching total products"
);

const getTotalCategories = countCard(
  reportService.getTotalCategories,
  "totalCategories",
  "Error fetching total categories"
);

module.exports = { getOverallRevenue, getTotalOrders, getTotalProducts, getTotalCategories };
