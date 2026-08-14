const Order = require("../../order/orderSchema");
const { SALE_STATUSES } = require("../../../shared/utils/salesAggregate");

// Every sales-report surface (on-screen table, Excel export, PDF export)
// has to load the same two sets of orders, or they disagree with each
// other — which is exactly what used to happen when each built its own
// query inline.
//
// Two separate queries, not one:
//  - sales are booked in the period they were ORDERED (orderedAt) and stay
//    there even if the item is later returned;
//  - returns are booked in the period the return was actually PROCESSED
//    (items.returnedAt), which can be a different, later period.
// See shared/utils/salesAggregate.js for the full reasoning.
const POPULATE_OPTS = {
  path: "items.productId",
  select: "productName brand regularPrice salePrice variants category",
  populate: { path: "category", select: "name" },
};

/**
 * @param {{start: Date, end: Date}} range
 * @returns {Promise<{salesOrders: Array, returnOrders: Array}>}
 */
async function fetchSalesAndReturns(range) {
  const [salesOrders, returnOrders] = await Promise.all([
    Order.find({
      orderedAt: { $gte: range.start, $lte: range.end },
      "items.orderStatus": { $in: SALE_STATUSES },
    })
      .populate(POPULATE_OPTS)
      .sort({ orderedAt: -1 }),
    Order.find({ "items.returnedAt": { $gte: range.start, $lte: range.end } }).populate(POPULATE_OPTS),
  ]);

  return { salesOrders, returnOrders };
}

module.exports = { fetchSalesAndReturns, POPULATE_OPTS };
