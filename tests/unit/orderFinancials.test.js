const { computeOrderFinancials } = require("../../src/shared/utils/orderFinancials");

function item(overrides) {
  return {
    orderStatus: "Delivered",
    totalPrice: 1000,
    ...overrides,
  };
}

describe("computeOrderFinancials", () => {
  test("all items active: amountPayable is subtotal minus discount plus shipping", () => {
    const order = {
      grandTotal: 1960,
      discount: 40,
      shipping: 40,
      items: [item({ totalPrice: 1000 }), item({ totalPrice: 1000 })],
    };
    const financials = computeOrderFinancials(order);
    expect(financials.activeSubtotal).toBe(2000);
    expect(financials.discountShare).toBe(40);
    expect(financials.amountPayable).toBe(2000 - 40 + 40);
    expect(financials.hasVoidedItems).toBe(false);
    expect(financials.allVoided).toBe(false);
  });

  test("mixed order: canceled item is excluded from amountPayable and its discount share", () => {
    const order = {
      grandTotal: 1960,
      discount: 100,
      shipping: 40,
      items: [
        item({ totalPrice: 1500, orderStatus: "Delivered" }),
        item({ totalPrice: 500, orderStatus: "canceled" }),
      ],
    };
    const financials = computeOrderFinancials(order);
    // Discount is apportioned by value share: active item is 1500/2000 of
    // the order, so it only carries 75% of the coupon discount.
    expect(financials.activeSubtotal).toBe(1500);
    expect(financials.discountShare).toBe(75);
    expect(financials.amountPayable).toBe(1500 - 75 + 40);
    expect(financials.hasVoidedItems).toBe(true);
    expect(financials.voidedAmount).toBe(500);
  });

  test("fully voided order: amountPayable and shipping both zero", () => {
    const order = {
      grandTotal: 1040,
      discount: 0,
      shipping: 40,
      items: [item({ totalPrice: 1000, orderStatus: "Returned" })],
    };
    const financials = computeOrderFinancials(order);
    expect(financials.allVoided).toBe(true);
    expect(financials.amountPayable).toBe(0);
  });

  test("orderTotal stays the frozen grandTotal regardless of item status", () => {
    const order = {
      grandTotal: 5000,
      discount: 0,
      shipping: 40,
      items: [item({ totalPrice: 5000, orderStatus: "canceled" })],
    };
    const financials = computeOrderFinancials(order);
    expect(financials.orderTotal).toBe(5000);
  });

  test("amountPayable never goes negative even if discount exceeds subtotal", () => {
    const order = {
      grandTotal: 100,
      discount: 500,
      shipping: 40,
      items: [item({ totalPrice: 100 })],
    };
    const financials = computeOrderFinancials(order);
    expect(financials.amountPayable).toBe(0);
  });
});
