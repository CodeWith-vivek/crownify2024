const Order = require("../order/orderSchema");
const { resolveReportRange, describeRange } = require("../../shared/utils/reportRange");
const {
  buildSalesRows,
  buildReturnRows,
  combineSalesAndReturns,
  RETURNED,
  SALE_STATUSES,
} = require("../../shared/utils/salesAggregate");
const { fetchSalesAndReturns } = require("./helpers/salesQuery");

// JSON endpoints backing the admin Sales Report page: the paginated table
// (+ period totals) and the revenue trend chart.

const generateSalesReport = async (req, res) => {
  const { type, startDate, endDate, page = 1, limit = 10 } = req.body;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, parseInt(limit, 10) || 10);

  try {
    const range = resolveReportRange(type, startDate, endDate);
    if (range.error) {
      return res.status(400).json({ status: false, message: range.error });
    }

    // Load the whole period, not just the current page. The period totals
    // shown on the stat cards previously only summed the 10 orders on the
    // visible page, so "Total sales" changed every time the admin paged —
    // a sales report has to report the period, not the page.
    const { salesOrders, returnOrders } = await fetchSalesAndReturns(range);

    const gross = buildSalesRows(salesOrders);
    const returnsAgg = buildReturnRows(returnOrders, range);
    const { totals } = combineSalesAndReturns(gross, returnsAgg);

    const totalOrders = gross.orders.length;
    const totalPages = Math.max(1, Math.ceil(totalOrders / limitNum));
    const skip = (pageNum - 1) * limitNum;
    const pageOrders = gross.orders.slice(skip, skip + limitNum);

    // 200 with an empty result set, not 404. "No sales this period" is a
    // valid answer, not a failure — returning 404 made React Query treat it
    // as an error, fire the global error toast, and retry the request.
    return res.json({
      status: true,
      report: pageOrders,
      // Not paginated — returns are typically far fewer than sales in a
      // period, and the sales report should surface them plainly rather
      // than netting them silently into one number.
      returns: returnsAgg.rows,
      totals,
      period: { type, start: range.start, end: range.end, label: describeRange(type, range) },
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalOrders,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
};

const salesChart = async (req, res) => {
  const { type, startDate, endDate } = req.body;

  try {
    const range = resolveReportRange(type, startDate, endDate);
    if (range.error) {
      return res.status(400).json({ status: false, message: range.error });
    }

    // Deliberately NOT using fetchSalesAndReturns here — the chart only
    // needs raw order documents to bucket by date and sum, never the
    // populated product/category fields, so it skips that populate cost.
    const [orders, returnOrders] = await Promise.all([
      Order.find({
        orderedAt: { $gte: range.start, $lte: range.end },
        "items.orderStatus": { $in: SALE_STATUSES },
      }).sort({ orderedAt: 1 }),
      Order.find({ "items.returnedAt": { $gte: range.start, $lte: range.end } }),
    ]);

    // Revenue per order counts its Delivered AND Returned items — the
    // original sale stays booked in the bucket it happened in, matching
    // buildSalesRows. It previously used order.grandTotal (the whole order,
    // including cancelled items) and excluded anything later returned, so
    // the chart both overstated live orders and retroactively understated
    // orders that were later returned.
    const revenueOf = (order) =>
      (order.items || [])
        .filter((it) => SALE_STATUSES.includes(it.orderStatus))
        .reduce((sum, it) => sum + (it.salePrice || 0) * (it.quantity || 0), 0);

    // Refund amount for a returned item, dated by when the return was
    // processed — same value-share formula used everywhere else refunds are
    // computed (adminController, credit note, buildReturnRows).
    const refundOf = (order, item) => {
      const totalOrderValue = (order.items || []).reduce((sum, it) => sum + (it.totalPrice || 0), 0);
      const itemShare = totalOrderValue > 0 ? item.totalPrice / totalOrderValue : 0;
      const discountForItem = Math.round((order.discount || 0) * itemShare);
      return Math.round(item.totalPrice - discountForItem);
    };

    // Bucket by an explicit key so every branch shares one implementation.
    // The old code had no "custom" branch at all, so a custom range returned
    // empty labels/revenue arrays and rendered a blank chart.
    const dayMs = 24 * 60 * 60 * 1000;
    const spanDays = Math.round((range.end - range.start) / dayMs) + 1;

    let granularity;
    if (type === "daily") granularity = "hour";
    else if (type === "yearly") granularity = "month";
    else if (spanDays > 62) granularity = "month";
    else granularity = "day";

    const buckets = new Map();
    const pushBucket = (key, label) => {
      if (!buckets.has(key)) buckets.set(key, { label, revenue: 0, orders: 0 });
    };

    if (granularity === "hour") {
      for (let h = 0; h < 24; h++) {
        pushBucket(String(h), `${String(h).padStart(2, "0")}:00`);
      }
    } else if (granularity === "month") {
      const cursor = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
      while (cursor <= range.end) {
        const key = `${cursor.getFullYear()}-${cursor.getMonth()}`;
        pushBucket(key, cursor.toLocaleString("en-IN", { month: "short", year: "numeric" }));
        cursor.setMonth(cursor.getMonth() + 1);
      }
    } else {
      const cursor = new Date(range.start);
      cursor.setHours(0, 0, 0, 0);
      while (cursor <= range.end) {
        const key = cursor.toISOString().slice(0, 10);
        pushBucket(key, cursor.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }));
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    const keyFor = (date) => {
      if (granularity === "hour") return String(date.getHours());
      if (granularity === "month") return `${date.getFullYear()}-${date.getMonth()}`;
      return date.toISOString().slice(0, 10);
    };

    for (const order of orders) {
      const when = new Date(order.orderedAt);
      const bucket = buckets.get(keyFor(when));
      if (!bucket) continue;
      bucket.revenue += revenueOf(order);
      bucket.orders += 1;
    }

    // Returns land in the bucket they were PROCESSED in, not the bucket the
    // original sale was in — a return in week 2 of a "weekly" chart reduces
    // week 2's bar, even if the item was originally bought weeks earlier.
    for (const order of returnOrders) {
      for (const item of order.items || []) {
        if (item.orderStatus !== RETURNED || !item.returnedAt) continue;
        const returnedAt = new Date(item.returnedAt);
        if (returnedAt < range.start || returnedAt > range.end) continue;
        const bucket = buckets.get(keyFor(returnedAt));
        if (!bucket) continue;
        bucket.revenue -= refundOf(order, item);
      }
    }

    const series = [...buckets.values()];
    const payload = {
      labels: series.map((b) => b.label),
      revenue: series.map((b) => Number(b.revenue.toFixed(2))),
      orders: series.map((b) => b.orders),
    };

    // Keyed by type for backwards compatibility with the dashboard, which
    // reads data.monthly; `series` is the type-agnostic accessor.
    return res.json({ status: true, series: payload, [type]: payload });
  } catch (error) {
    console.error("Error fetching sales chart:", error);
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
};

module.exports = { generateSalesReport, salesChart };
