const Product = require("../../product/productSchema");

/**
 * Order line items are identified by their variant (size + colour), not by
 * an index — the client sends { orderNumber, productSize, productColor }.
 * Matching is case-insensitive because the stored variant casing and what
 * the client echoes back have historically differed.
 *
 * This lookup was written out three times (cancelOrder, returnItem,
 * cancelReturn); cancelReturn's copy had drifted to a different shape
 * entirely and was silently broken for a while as a result.
 *
 * @returns {number} index into order.items, or -1
 */
function findOrderItemIndexByVariant(order, productSize, productColor) {
  return order.items.findIndex((item) => {
    if (!item.variant) return false;
    return (
      item.variant.size.toUpperCase() === productSize.toUpperCase() &&
      item.variant.color.toUpperCase() === productColor.toUpperCase()
    );
  });
}

/**
 * Value-share of the order-level coupon discount attributable to one item,
 * and the resulting refund. The same formula has to be used everywhere a
 * refund is computed (here, the admin return flow, the credit note, and
 * the sales report's return rows) or the figures disagree.
 *
 * Math.round rather than Math.floor — flooring systematically shortchanges
 * the customer on every single refund.
 */
function computeItemRefund(order, orderItem) {
  const totalOrderPrice = order.items.reduce((sum, item) => sum + item.totalPrice, 0);
  const itemShare = totalOrderPrice > 0 ? orderItem.totalPrice / totalOrderPrice : 0;
  const discountForItem = Math.round((order.discount || 0) * itemShare);
  const refundAmount = Math.round(orderItem.totalPrice - discountForItem);
  return { itemShare, discountForItem, refundAmount };
}

/**
 * Decrements on-hand stock for each ordered line. Takes either cart items
 * or order items — both carry { productId, variant: {size, color}, quantity }.
 */
async function decrementStockForItems(items) {
  for (const item of items) {
    const product = await Product.findById(item.productId);
    if (!product) continue;

    const variantIndex = product.variants.findIndex(
      (v) => v.size === item.variant.size && v.color === item.variant.color
    );
    if (variantIndex === -1) continue;

    product.variants[variantIndex].quantity -= item.quantity;
    await product.save();
  }
}

/** Restores stock for a single cancelled/returned line. */
async function restoreStockForItem(orderItem, productSize, productColor) {
  const product = await Product.findById(orderItem.productId);
  if (!product) return;

  const variantIndex = product.variants.findIndex(
    (v) =>
      v.size.toUpperCase() === productSize.toUpperCase() &&
      v.color.toUpperCase() === productColor.toUpperCase()
  );
  if (variantIndex === -1) return;

  product.variants[variantIndex].quantity += orderItem.quantity;
  await product.save();
}

module.exports = {
  findOrderItemIndexByVariant,
  computeItemRefund,
  decrementStockForItems,
  restoreStockForItem,
};
