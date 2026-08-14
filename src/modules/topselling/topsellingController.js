const topsellingService = require("./topselling.service");
const { sendError } = require("../../shared/errors/respond");

// HTTP adapter for the admin dashboard's top-selling panels. Aggregation
// lives in topselling.service.js.

const getTopSellingStats = async (req, res) => {
  try {
    const data = await topsellingService.getTopSellingStats();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "Error fetching top-selling stats");
  }
};

module.exports = { getTopSellingStats };
