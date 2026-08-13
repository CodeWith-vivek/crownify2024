const {
  buildSalesRows,
  buildReturnRows,
  combineSalesAndReturns,
} = require("../../src/shared/utils/salesAggregate");

function makeOrder(overrides) {
  return {
    orderNumber: "ORD1",
    orderedAt: new Date("2026-01-10"),
    paymentMethod: "COD",
    discount: 0,
    shipping: 40,
    items: [],
    ...overrides,
  };
}

function makeItem(overrides) {
  return {
    orderStatus: "Delivered",
    productId: { productName: "Cap", brand: "Acme" },
    productName: "Cap",
    variant: { size: "ONESIZE", color: "Black" },
    quantity: 1,
    regularPrice: 500,
    salePrice: 400,
    totalPrice: 400,
    ...overrides,
  };
}

describe("buildSalesRows", () => {
  test("counts Delivered and Returned items as sales, ignores canceled/Failed", () => {
    const orders = [
      makeOrder({
        items: [
          makeItem({ orderStatus: "Delivered", salePrice: 400, totalPrice: 400 }),
          makeItem({ orderStatus: "canceled", salePrice: 300, totalPrice: 300 }),
          makeItem({ orderStatus: "Returned", salePrice: 200, totalPrice: 200 }),
        ],
      }),
    ];
    const result = buildSalesRows(orders);
    expect(result.rows).toHaveLength(2);
    expect(result.totals.totalItemTotal).toBe(600);
  });

  test("net revenue subtracts coupon discount, not item discount", () => {
    const orders = [
      makeOrder({
        discount: 50,
        items: [makeItem({ salePrice: 400, totalPrice: 400 })],
      }),
    ];
    const result = buildSalesRows(orders);
    expect(result.totals.netRevenue).toBe(400 - 50);
  });

  test("orders with no sale-status items are skipped entirely", () => {
    const orders = [makeOrder({ items: [makeItem({ orderStatus: "canceled" })] })];
    const result = buildSalesRows(orders);
    expect(result.totals.totalOrders).toBe(0);
    expect(result.rows).toHaveLength(0);
  });
});

describe("buildReturnRows", () => {
  const range = { start: new Date("2026-02-01"), end: new Date("2026-02-28T23:59:59") };

  test("only includes Returned items whose returnedAt falls in range", () => {
    const orders = [
      makeOrder({
        discount: 0,
        items: [
          makeItem({ orderStatus: "Returned", totalPrice: 400, returnedAt: new Date("2026-02-15") }),
          makeItem({ orderStatus: "Returned", totalPrice: 300, returnedAt: new Date("2026-01-15") }), // outside range
          makeItem({ orderStatus: "Delivered", totalPrice: 200 }), // not returned at all
        ],
      }),
    ];
    const result = buildReturnRows(orders, range);
    expect(result.rows).toHaveLength(1);
    expect(result.totals.totalReturns).toBe(400);
  });

  test("refund amount is reduced by the item's discount share", () => {
    const orders = [
      makeOrder({
        discount: 100,
        items: [
          makeItem({ orderStatus: "Returned", totalPrice: 500, returnedAt: new Date("2026-02-10") }),
          makeItem({ orderStatus: "Delivered", totalPrice: 500 }),
        ],
      }),
    ];
    const result = buildReturnRows(orders, range);
    // Returned item is 500/1000 of order value -> carries 50% of the ₹100 discount.
    expect(result.totals.totalReturns).toBe(450);
  });

  test("rows carry a negative itemTotal", () => {
    const orders = [
      makeOrder({
        items: [makeItem({ orderStatus: "Returned", totalPrice: 400, returnedAt: new Date("2026-02-10") })],
      }),
    ];
    const result = buildReturnRows(orders, range);
    expect(result.rows[0].itemTotal).toBe(-400);
  });
});

describe("combineSalesAndReturns", () => {
  test("net revenue is gross minus that period's returns", () => {
    const gross = { rows: [], orders: [], totals: { totalOrders: 2, netRevenue: 1000 } };
    const returns = { rows: [], totals: { totalReturns: 300, totalReturnedItems: 1, totalReturnedQuantity: 1 } };
    const combined = combineSalesAndReturns(gross, returns);
    expect(combined.totals.netRevenue).toBe(700);
    expect(combined.totals.averageOrderValue).toBe(350);
  });
});
