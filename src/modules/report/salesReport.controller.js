const reportService = require("./report.service");
const { sendError } = require("../../shared/errors/respond");

// HTTP adapters for the admin Sales Report page: the paginated table
// (+ period totals) and the revenue trend chart. Aggregation lives in
// report.service.js.
//
// These endpoints answer with `status`, not `success` — the admin client
// reads that key.

const generateSalesReport = async (req, res) => {
  try {
    const result = await reportService.getSalesReport({
      type: req.body.type,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      page: req.body.page,
      limit: req.body.limit,
    });

    // 200 with an empty result set, not 404. "No sales this period" is a
    // valid answer, not a failure — returning 404 made React Query treat it
    // as an error, fire the global error toast, and retry the request.
    return res.json({ status: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error generating sales report", { flag: "status" });
  }
};

const salesChart = async (req, res) => {
  try {
    const result = await reportService.getSalesChart({
      type: req.body.type,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
    });
    return res.json({ status: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error fetching sales chart", { flag: "status" });
  }
};

module.exports = { generateSalesReport, salesChart };
