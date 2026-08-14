const { RETURNED, SALE_STATUSES } = require("../../../shared/utils/salesAggregate");

// Bucketing for the revenue trend chart. Pure: given a range and two sets
// of order documents, produce the labels/revenue/orders arrays the chart
// renders. No database, no Express.

const DAY_MS = 24 * 60 * 60 * 1000;

// Above this many days a per-day chart is unreadable, so it rolls up to
// months.
const MAX_DAILY_BUCKETS = 62;

/**
 * Revenue per order counts its Delivered AND Returned items — the original
 * sale stays booked in the bucket it happened in, matching buildSalesRows.
 * Using order.grandTotal instead both overstated live orders (it includes
 * cancelled items) and retroactively understated orders later returned.
 */
const revenueOf = (order) =>
  (order.items || [])
    .filter((item) => SALE_STATUSES.includes(item.orderStatus))
    .reduce((sum, item) => sum + (item.salePrice || 0) * (item.quantity || 0), 0);

/**
 * Refund for a returned item — the same value-share formula used
 * everywhere else refunds are computed (adminController, credit note,
 * buildReturnRows).
 */
const refundOf = (order, item) => {
  const orderValue = (order.items || []).reduce((sum, it) => sum + (it.totalPrice || 0), 0);
  const itemShare = orderValue > 0 ? item.totalPrice / orderValue : 0;
  return Math.round(item.totalPrice - Math.round((order.discount || 0) * itemShare));
};

function resolveGranularity(type, range) {
  if (type === "daily") return "hour";
  if (type === "yearly") return "month";

  const spanDays = Math.round((range.end - range.start) / DAY_MS) + 1;
  return spanDays > MAX_DAILY_BUCKETS ? "month" : "day";
}

/**
 * Day buckets are keyed by the LOCAL calendar date, not by
 * toISOString().slice(0, 10).
 *
 * The seeding loop walks local midnights while the lookup keyed a real
 * order timestamp — so in any timezone ahead of UTC the two disagreed by a
 * day (local midnight IST is 18:30 UTC the day before). Every order placed
 * before 05:30 IST fell outside every seeded bucket and silently vanished
 * from the chart. Local is the right basis either way, since the labels
 * are already rendered with toLocaleDateString.
 */
const localDateKey = (date) =>
  `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

/**
 * Pre-seeds every bucket in the range so gaps render as zero rather than
 * collapsing the axis.
 */
function seedBuckets(granularity, range) {
  const buckets = new Map();
  const add = (key, label) => buckets.set(key, { label, revenue: 0, orders: 0 });

  if (granularity === "hour") {
    for (let hour = 0; hour < 24; hour++) {
      add(String(hour), `${String(hour).padStart(2, "0")}:00`);
    }
    return buckets;
  }

  if (granularity === "month") {
    const cursor = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
    while (cursor <= range.end) {
      add(
        `${cursor.getFullYear()}-${cursor.getMonth()}`,
        cursor.toLocaleString("en-IN", { month: "short", year: "numeric" })
      );
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return buckets;
  }

  const cursor = new Date(range.start);
  cursor.setHours(0, 0, 0, 0);
  while (cursor <= range.end) {
    add(
      localDateKey(cursor),
      cursor.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
    );
    cursor.setDate(cursor.getDate() + 1);
  }
  return buckets;
}

const keyFor = (date, granularity) => {
  if (granularity === "hour") return String(date.getHours());
  if (granularity === "month") return `${date.getFullYear()}-${date.getMonth()}`;
  return localDateKey(date);
};

/**
 * @param {{type: string, range: {start: Date, end: Date}, orders: Array, returnOrders: Array}} args
 * @returns {{labels: string[], revenue: number[], orders: number[]}}
 */
function buildChartSeries({ type, range, orders = [], returnOrders = [] }) {
  const granularity = resolveGranularity(type, range);
  const buckets = seedBuckets(granularity, range);

  for (const order of orders) {
    const bucket = buckets.get(keyFor(new Date(order.orderedAt), granularity));
    if (!bucket) continue;
    bucket.revenue += revenueOf(order);
    bucket.orders += 1;
  }

  // Returns land in the bucket they were PROCESSED in, not the bucket the
  // original sale was in — a return in week 2 of a "weekly" chart reduces
  // week 2's bar, even if the item was bought weeks earlier.
  for (const order of returnOrders) {
    for (const item of order.items || []) {
      if (item.orderStatus !== RETURNED || !item.returnedAt) continue;

      const returnedAt = new Date(item.returnedAt);
      if (returnedAt < range.start || returnedAt > range.end) continue;

      const bucket = buckets.get(keyFor(returnedAt, granularity));
      if (bucket) bucket.revenue -= refundOf(order, item);
    }
  }

  const series = [...buckets.values()];
  return {
    labels: series.map((bucket) => bucket.label),
    revenue: series.map((bucket) => Number(bucket.revenue.toFixed(2))),
    orders: series.map((bucket) => bucket.orders),
  };
}

module.exports = { buildChartSeries, resolveGranularity, revenueOf, refundOf, MAX_DAILY_BUCKETS };
