const Order = require("../order/orderSchema");
const Product = require("../product/productSchema");
const Category = require("../category/categorySchema");
const { resolveReportRange, describeRange } = require("../../shared/utils/reportRange");
const {
  buildSalesRows,
  buildReturnRows,
  combineSalesAndReturns,
  SALE_STATUSES,
} = require("../../shared/utils/salesAggregate");
const { fetchSalesAndReturns } = require("./helpers/salesQuery");
const { buildChartSeries } = require("./helpers/salesChart");
const { badRequest } = require("../../shared/errors/AppError");

// Reporting reads, free of Express.
//
// Unlike the other modules, almost nothing here is a business *rule* — it
// is aggregation. So the service's job is narrower: own the query pipeline
// so the on-screen table, the Excel export and the PDF export cannot drift
// apart, and leave rendering to the controllers.

const DEFAULT_PAGE_SIZE = 10;

/**
 * The one pipeline behind every sales-report surface: resolve the period,
 * load its sales and returns, and reduce them to rows plus totals.
 *
 * Table, Excel and PDF all go through this. When each built its own copy
 * they reported different numbers for the same period.
 */
async function loadSalesData({ type, startDate, endDate }) {
  const range = resolveReportRange(type, startDate, endDate);
  if (range.error) throw badRequest(range.error);

  const { salesOrders, returnOrders } = await fetchSalesAndReturns(range);

  const gross = buildSalesRows(salesOrders);
  const returnsAgg = buildReturnRows(returnOrders, range);
  const { rows, orders, totals } = combineSalesAndReturns(gross, returnsAgg);

  return {
    range,
    label: describeRange(type, range),
    gross,
    // `orders` is one entry per order (what the table and the PDF list);
    // `rows` is one entry per line item, sales and returns interleaved
    // (what the Excel export writes).
    orders,
    returnRows: returnsAgg.rows,
    rows,
    totals,
  };
}

/**
 * The paginated admin table. Pagination is applied to the sales rows only,
 * after the period totals have been computed from the whole period — the
 * stat cards used to sum just the visible page, so "Total sales" changed
 * every time the admin paged.
 */
async function getSalesReport({ type, startDate, endDate, page = 1, limit = DEFAULT_PAGE_SIZE }) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, parseInt(limit, 10) || DEFAULT_PAGE_SIZE);

  const { range, label, gross, returnRows, totals } = await loadSalesData({
    type,
    startDate,
    endDate,
  });

  const totalOrders = gross.orders.length;
  const totalPages = Math.max(1, Math.ceil(totalOrders / limitNum));
  const skip = (pageNum - 1) * limitNum;

  return {
    report: gross.orders.slice(skip, skip + limitNum),
    // Not paginated — returns are typically far fewer than sales in a
    // period, and the sales report should surface them plainly rather than
    // netting them silently into one number.
    returns: returnRows,
    totals,
    period: { type, start: range.start, end: range.end, label },
    pagination: {
      currentPage: pageNum,
      totalPages,
      totalOrders,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1,
    },
  };
}

/**
 * The revenue trend chart.
 *
 * Deliberately NOT using loadSalesData — the chart only needs raw order
 * documents to bucket by date and sum, never the populated
 * product/category fields, so it skips that populate cost.
 */
async function getSalesChart({ type, startDate, endDate }) {
  const range = resolveReportRange(type, startDate, endDate);
  if (range.error) throw badRequest(range.error);

  const [orders, returnOrders] = await Promise.all([
    Order.find({
      orderedAt: { $gte: range.start, $lte: range.end },
      "items.orderStatus": { $in: SALE_STATUSES },
    }).sort({ orderedAt: 1 }),
    Order.find({ "items.returnedAt": { $gte: range.start, $lte: range.end } }),
  ]);

  const series = buildChartSeries({ type, range, orders, returnOrders });

  // Keyed by type as well for backwards compatibility with the dashboard,
  // which reads data.monthly; `series` is the type-agnostic accessor.
  return { series, [type]: series };
}

async function getOverallRevenue() {
  const [result] = await Order.aggregate([
    { $unwind: "$items" },
    { $match: { "items.orderStatus": "Delivered" } },
    {
      $group: {
        _id: "$_id",
        orderTotal: { $sum: "$items.salePrice" },
        orderDiscount: { $first: "$discount" },
      },
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$orderTotal" },
        totalDiscount: { $sum: "$orderDiscount" },
      },
    },
  ]);

  if (!result) {
    return {
      message: "No revenue data available",
      revenue: { totalRevenue: 0, totalDiscount: 0, netRevenue: 0 },
    };
  }

  const { totalRevenue, totalDiscount } = result;
  return { revenue: { totalRevenue, totalDiscount, netRevenue: totalRevenue - totalDiscount } };
}

const getTotalOrders = () => Order.countDocuments({});
const getTotalProducts = () => Product.countDocuments({});
const getTotalCategories = () => Category.countDocuments({});

module.exports = {
  loadSalesData,
  getSalesReport,
  getSalesChart,
  getOverallRevenue,
  getTotalOrders,
  getTotalProducts,
  getTotalCategories,
  DEFAULT_PAGE_SIZE,
};
