/**
 * order.grandTotal is frozen at checkout — cancelling or returning an item
 * never adjusts it, so it drifts away from what the customer actually ends
 * up paying for as soon as anything in a multi-item order changes status.
 * This computes the live figure on read, without touching the stored value
 * (which stays as the historical "what was ordered" record — that's correct
 * to keep, real invoices/orders always retain their original amount too).
 */

// Items in these states have no money currently with the merchant — either
// refunded (Returned) or never charged through to the customer (canceled).
const VOID_STATUSES = ["canceled", "Returned"];

function computeOrderFinancials(order) {
  const items = order.items || [];
  const orderTotal = order.grandTotal || 0;

  const activeItems = items.filter((item) => !VOID_STATUSES.includes(item.orderStatus));
  const voidedItems = items.filter((item) => VOID_STATUSES.includes(item.orderStatus));

  const totalItemValue = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  const activeSubtotal = activeItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  const voidedAmount = voidedItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0);

  // Discount is apportioned by value share, same approach used for refund
  // calculations elsewhere (admin return flow, credit note) — a coupon
  // applied to the whole order gets split across surviving items the same
  // way the original discount was implicitly split when the order was cut.
  const discountShare =
    totalItemValue > 0 ? Math.round((order.discount || 0) * (activeSubtotal / totalItemValue)) : 0;

  const shipping = order.shipping ?? 0;
  const amountPayable = activeItems.length > 0 ? Math.max(0, activeSubtotal - discountShare + shipping) : 0;

  return {
    orderTotal,
    amountPayable,
    activeSubtotal,
    discountShare,
    shipping,
    voidedAmount,
    hasVoidedItems: voidedItems.length > 0,
    allVoided: items.length > 0 && activeItems.length === 0,
  };
}

module.exports = { computeOrderFinancials, VOID_STATUSES };
