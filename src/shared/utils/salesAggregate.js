/**
 * Shared aggregation for the sales report, used by the on-screen table, the
 * PDF export and the Excel export so all three always agree.
 *
 * Two kinds of rows make up a period's report, matching how real invoicing
 * systems book revenue:
 *
 *  - buildSalesRows(): the ORIGINAL sale, dated by when it was placed
 *    (orderedAt). This stays booked in the period it happened even if the
 *    item is later returned — a return doesn't rewrite history.
 *  - buildReturnRows(): the REFUND, dated by when the return was actually
 *    processed (item.returnedAt), as a separate NEGATIVE entry. This can
 *    land in a different, later period than the original sale.
 *
 * Net revenue for a period = that period's gross sales minus that period's
 * processed returns — not "whatever is currently Delivered", which is what
 * this used to compute. The old approach made a return retroactively erase
 * itself from the month it was actually sold in: run the same report twice
 * with a customer return in between and last month's numbers would change.
 */

const DELIVERED = "Delivered";
const RETURNED = "Returned";
// The original sale stays on the books whether or not it was later
// returned — only cancelled/failed items were never actually sold.
const SALE_STATUSES = [DELIVERED, RETURNED];

/**
 * Flattens orders into per-item report rows (their ORIGINAL sale, positive)
 * and accumulates period totals. Callers should query orders by orderedAt
 * within the period AND items.orderStatus in [Delivered, Returned].
 *
 * @param {Array} orders Mongoose Order docs with items.productId populated
 * @returns {{ rows: Array, orders: Array, totals: Object }}
 */
function buildSalesRows(orders) {
  const totals = {
    totalOrders: 0,
    totalQuantity: 0,
    totalRegularPrice: 0,
    totalSalePrice: 0,
    totalItemDiscount: 0,
    totalCouponDiscount: 0,
    totalItemTotal: 0,
    totalShipping: 0,
    totalOrderTotal: 0,
  };

  const rows = [];
  const grouped = [];

  for (const order of orders) {
    if (!order || !Array.isArray(order.items)) continue;

    const soldItems = order.items.filter((item) => SALE_STATUSES.includes(item.orderStatus));
    if (soldItems.length === 0) continue;

    totals.totalOrders += 1;

    const shippingPerItem = (order.shipping || 0) / soldItems.length;
    const couponPerItem = (order.discount || 0) / soldItems.length;

    const items = soldItems.map((item) => {
      // item.productId can be null if the product was hard-deleted after the
      // order was placed — fall back to the name frozen on the order line.
      const product = item.productId || {};
      const quantity = item.quantity || 0;
      const regularPrice = item.regularPrice || 0;
      const salePrice = item.salePrice || 0;
      const itemTotal = salePrice * quantity;

      totals.totalQuantity += quantity;
      totals.totalRegularPrice += regularPrice * quantity;
      totals.totalSalePrice += salePrice * quantity;
      totals.totalItemDiscount += (regularPrice - salePrice) * quantity;
      totals.totalCouponDiscount += couponPerItem;
      totals.totalItemTotal += itemTotal;
      totals.totalShipping += shippingPerItem;
      totals.totalOrderTotal += itemTotal + shippingPerItem - couponPerItem;

      const row = {
        type: "sale",
        orderNumber: order.orderNumber || "N/A",
        date: order.orderedAt ? order.orderedAt.toISOString().split("T")[0] : "N/A",
        status: item.orderStatus,
        name: item.productName || product.productName || "N/A",
        brand: product.brand || "N/A",
        // The variant actually ordered, not the product's first variant.
        color: item.variant?.color || "N/A",
        size: item.variant?.size || "N/A",
        category: product.category?.name || "N/A",
        quantity,
        regularPrice,
        salePrice,
        itemDiscount: (regularPrice - salePrice) * quantity,
        couponDiscount: couponPerItem,
        shipping: shippingPerItem,
        itemTotal,
      };
      rows.push(row);
      return row;
    });

    grouped.push({
      orderNumber: order.orderNumber || "N/A",
      date: order.orderedAt ? order.orderedAt.toISOString().split("T")[0] : "N/A",
      paymentMethod: order.paymentMethod || "N/A",
      items,
    });
  }

  // Net revenue after coupon discounts — the figure an accountant cares
  // about, and what "Total Sales" should mean on a sales report. Callers
  // that also account for returns should subtract buildReturnRows' totals
  // from this (see combineSalesAndReturns).
  totals.netRevenue = totals.totalItemTotal - totals.totalCouponDiscount;
  totals.averageOrderValue = totals.totalOrders > 0 ? totals.netRevenue / totals.totalOrders : 0;

  return { rows, orders: grouped, totals };
}

/**
 * Negative entries for returns actually PROCESSED within the period, dated
 * by item.returnedAt rather than the order's original orderedAt. Callers
 * should query orders by "items.returnedAt" within the period — that query
 * matches an order if ANY item's returnedAt falls in range, so this also
 * re-checks each item individually against the same range before including
 * it (an order can have several returns processed on different dates).
 *
 * Refund amount uses the same value-share-of-discount formula as the actual
 * refund flow (adminController.updateOrderStatusByAdmin / the credit note
 * generator) so the figure here matches what was actually credited.
 *
 * @param {Array} orders
 * @param {{ start: Date, end: Date }} range
 */
function buildReturnRows(orders, range) {
  const totals = {
    totalReturns: 0,
    totalReturnedItems: 0,
    totalReturnedQuantity: 0,
  };
  const rows = [];

  for (const order of orders) {
    if (!order || !Array.isArray(order.items)) continue;

    const totalOrderValue = order.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);

    for (const item of order.items) {
      if (item.orderStatus !== RETURNED || !item.returnedAt) continue;
      if (item.returnedAt < range.start || item.returnedAt > range.end) continue;

      const product = item.productId || {};
      const itemShare = totalOrderValue > 0 ? item.totalPrice / totalOrderValue : 0;
      const discountForItem = Math.round((order.discount || 0) * itemShare);
      const refundAmount = Math.round(item.totalPrice - discountForItem);

      totals.totalReturns += refundAmount;
      totals.totalReturnedItems += 1;
      totals.totalReturnedQuantity += item.quantity || 0;

      rows.push({
        type: "return",
        orderNumber: order.orderNumber || "N/A",
        date: item.returnedAt.toISOString().split("T")[0],
        status: "Returned (refund)",
        name: item.productName || product.productName || "N/A",
        brand: product.brand || "N/A",
        color: item.variant?.color || "N/A",
        size: item.variant?.size || "N/A",
        category: product.category?.name || "N/A",
        quantity: item.quantity || 0,
        regularPrice: item.regularPrice || 0,
        salePrice: item.salePrice || 0,
        itemDiscount: 0,
        couponDiscount: discountForItem,
        shipping: 0,
        // Negative — this is a deduction from the period's revenue, not a
        // sale. Consumers rendering a "Total" column can sum rows as-is.
        itemTotal: -refundAmount,
      });
    }
  }

  return { rows, totals };
}

/**
 * Merges a buildSalesRows() result with a buildReturnRows() result into one
 * period report: combined row list and totals with netRevenue reduced by
 * that period's processed returns.
 */
function combineSalesAndReturns(gross, returns) {
  return {
    rows: [...gross.rows, ...returns.rows],
    orders: gross.orders,
    totals: {
      ...gross.totals,
      totalReturns: returns.totals.totalReturns,
      totalReturnedItems: returns.totals.totalReturnedItems,
      totalReturnedQuantity: returns.totals.totalReturnedQuantity,
      netRevenue: gross.totals.netRevenue - returns.totals.totalReturns,
      averageOrderValue:
        gross.totals.totalOrders > 0
          ? (gross.totals.netRevenue - returns.totals.totalReturns) / gross.totals.totalOrders
          : 0,
    },
  };
}

module.exports = { buildSalesRows, buildReturnRows, combineSalesAndReturns, DELIVERED, RETURNED, SALE_STATUSES };
