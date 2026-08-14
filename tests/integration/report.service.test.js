const mongoose = require("mongoose");
const { startTestDb } = require("../setup/testDb");
const reportService = require("../../src/modules/report/report.service");
const { buildChartSeries, resolveGranularity } = require("../../src/modules/report/helpers/salesChart");
const User = require("../../src/modules/user/userSchema");
const Order = require("../../src/modules/order/orderSchema");
const Product = require("../../src/modules/product/productSchema");
const Category = require("../../src/modules/category/categorySchema");
const Address = require("../../src/modules/address/addressSchema");

let db;

beforeAll(async () => {
  db = await startTestDb();
});

afterEach(async () => {
  await db.clear();
});

afterAll(async () => {
  await db.stop();
});

let seq = 0;

async function seedOrder({
  orderedAt = new Date(),
  orderStatus = "Delivered",
  quantity = 1,
  salePrice = 400,
  returnedAt = null,
  discount = 0,
} = {}) {
  const category = await Category.create({ name: `Caps${seq}`, description: "d" });
  const product = await Product.create({
    productName: `Cap${seq}`,
    description: "d",
    brand: "Acme",
    category: category._id,
    regularPrice: 500,
    salePrice,
    productImage: ["i.jpg"],
    variants: [{ color: "Black", size: "ONESIZE", quantity: 50 }],
  });
  const user = await User.create({ name: "T", email: `u${seq}@rep.com` });
  const address = await Address.create({
    userId: user._id,
    addressType: "Home",
    fullName: "T",
    country: "India",
    mobileNumber: "9999999999",
    postalCode: "600001",
    flatHouseCompany: "1",
    areaStreet: "Street",
    city: "Chennai",
    state: "TN",
  });

  seq += 1;

  return Order.create({
    userId: user._id,
    orderNumber: `RPT-${seq}-${new mongoose.Types.ObjectId()}`,
    shippingAddress: address._id,
    orderedAt,
    discount,
    items: [
      {
        productId: product._id,
        productName: product.productName,
        productImage: "i.jpg",
        variant: { color: "Black", size: "ONESIZE" },
        quantity,
        salePrice,
        regularPrice: 500,
        totalPrice: salePrice * quantity,
        orderStatus,
        ...(returnedAt ? { returnedAt } : {}),
      },
    ],
    subtotal: salePrice * quantity,
    shipping: 40,
    total: salePrice * quantity + 40,
    grandTotal: salePrice * quantity + 40,
    paymentMethod: "COD",
  });
}

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

describe("reportService.loadSalesData", () => {
  test("rejects an invalid period with a 400, not a 500", async () => {
    await expect(
      reportService.loadSalesData({ type: "custom", startDate: null, endDate: null })
    ).rejects.toMatchObject({ isAppError: true, status: 400 });
  });

  test("counts only delivered/returned items as sales", async () => {
    await seedOrder({ orderStatus: "Delivered", salePrice: 400 });
    await seedOrder({ orderStatus: "canceled", salePrice: 999 });

    const { totals, orders } = await reportService.loadSalesData({ type: "monthly" });

    expect(orders).toHaveLength(1);
    expect(totals.totalSalePrice).toBe(400);
  });

  test("an empty period is a valid answer, not an error", async () => {
    const { orders, rows, totals } = await reportService.loadSalesData({ type: "daily" });

    expect(orders).toHaveLength(0);
    expect(rows).toHaveLength(0);
    expect(totals.totalOrders).toBe(0);
  });
});

describe("reportService.getSalesReport", () => {
  test("paginates the rows but totals the whole period", async () => {
    for (let i = 0; i < 5; i++) await seedOrder({ salePrice: 100 });

    const page1 = await reportService.getSalesReport({ type: "monthly", page: 1, limit: 2 });

    expect(page1.report).toHaveLength(2);
    expect(page1.pagination).toMatchObject({
      currentPage: 1,
      totalPages: 3,
      totalOrders: 5,
      hasNextPage: true,
      hasPrevPage: false,
    });

    const page3 = await reportService.getSalesReport({ type: "monthly", page: 3, limit: 2 });
    expect(page3.report).toHaveLength(1);
    expect(page3.pagination.hasNextPage).toBe(false);

    // The figure on the stat cards is the same on every page — it used to
    // sum only the visible rows.
    expect(page3.totals.totalSalePrice).toBe(page1.totals.totalSalePrice);
    expect(page1.totals.totalSalePrice).toBe(500);
  });

  test("clamps a nonsense page and limit rather than throwing", async () => {
    await seedOrder();

    const res = await reportService.getSalesReport({
      type: "monthly",
      page: "-4",
      limit: "abc",
    });

    expect(res.pagination.currentPage).toBe(1);
    expect(res.report).toHaveLength(1);
  });

  test("carries the resolved period back to the caller", async () => {
    const res = await reportService.getSalesReport({ type: "yearly" });

    expect(res.period.type).toBe("yearly");
    expect(res.period.label).toEqual(expect.any(String));
    expect(res.period.start).toBeInstanceOf(Date);
  });
});

describe("reportService.getSalesChart", () => {
  test("a daily chart has one bucket per hour", async () => {
    await seedOrder({ salePrice: 300 });

    const { series, daily } = await reportService.getSalesChart({ type: "daily" });

    expect(series.labels).toHaveLength(24);
    expect(series.revenue).toHaveLength(24);
    // Keyed by type as well, for the dashboard's data.monthly accessor.
    expect(daily).toEqual(series);
    expect(series.revenue.reduce((a, b) => a + b, 0)).toBe(300);
  });

  test("a yearly chart has one bucket per month", async () => {
    const { series } = await reportService.getSalesChart({ type: "yearly" });
    expect(series.labels).toHaveLength(12);
  });

  test("an invalid custom range is a 400", async () => {
    await expect(
      reportService.getSalesChart({ type: "custom", startDate: null, endDate: null })
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("salesChart helper", () => {
  const range = { start: daysAgo(6), end: new Date() };

  test("granularity follows the period, and long spans roll up to months", () => {
    expect(resolveGranularity("daily", range)).toBe("hour");
    expect(resolveGranularity("yearly", range)).toBe("month");
    expect(resolveGranularity("weekly", range)).toBe("day");
    expect(
      resolveGranularity("custom", { start: daysAgo(200), end: new Date() })
    ).toBe("month");
  });

  test("gaps in the range are seeded as zero rather than skipped", () => {
    const series = buildChartSeries({ type: "weekly", range, orders: [], returnOrders: [] });

    expect(series.labels).toHaveLength(7);
    expect(series.revenue.every((value) => value === 0)).toBe(true);
  });

  test("revenue counts delivered items and ignores cancelled ones", () => {
    const orders = [
      {
        orderedAt: range.end,
        items: [
          { orderStatus: "Delivered", salePrice: 100, quantity: 2 },
          { orderStatus: "canceled", salePrice: 999, quantity: 1 },
        ],
      },
    ];

    const series = buildChartSeries({ type: "weekly", range, orders, returnOrders: [] });

    expect(series.revenue.reduce((a, b) => a + b, 0)).toBe(200);
    expect(series.orders.reduce((a, b) => a + b, 0)).toBe(1);
  });

  test("a return is subtracted from the bucket it was processed in", () => {
    const orders = [
      { orderedAt: daysAgo(5), items: [{ orderStatus: "Delivered", salePrice: 500, quantity: 1 }] },
    ];
    const returnOrders = [
      {
        discount: 0,
        items: [
          {
            orderStatus: "Returned",
            returnedAt: range.end,
            totalPrice: 500,
            salePrice: 500,
            quantity: 1,
          },
        ],
      },
    ];

    const series = buildChartSeries({ type: "weekly", range, orders, returnOrders });

    // The sale is booked on day 5 and the refund on the last day, so they
    // land in different buckets and net to zero overall.
    expect(series.revenue.reduce((a, b) => a + b, 0)).toBe(0);
    expect(series.revenue[series.revenue.length - 1]).toBe(-500);
  });

  test("a return processed outside the range is ignored", () => {
    const returnOrders = [
      {
        discount: 0,
        items: [
          {
            orderStatus: "Returned",
            returnedAt: daysAgo(400),
            totalPrice: 500,
            quantity: 1,
          },
        ],
      },
    ];

    const series = buildChartSeries({ type: "weekly", range, orders: [], returnOrders });
    expect(series.revenue.every((value) => value === 0)).toBe(true);
  });
});

describe("reportService dashboard stats", () => {
  test("overall revenue nets the discount off the delivered total", async () => {
    await seedOrder({ orderStatus: "Delivered", salePrice: 400, discount: 50 });

    const { revenue } = await reportService.getOverallRevenue();

    expect(revenue.totalRevenue).toBe(400);
    expect(revenue.totalDiscount).toBe(50);
    expect(revenue.netRevenue).toBe(350);
  });

  test("an empty database reports zeroes, not a crash", async () => {
    const { revenue, message } = await reportService.getOverallRevenue();

    expect(revenue).toEqual({ totalRevenue: 0, totalDiscount: 0, netRevenue: 0 });
    expect(message).toBe("No revenue data available");
  });

  test("the count cards count", async () => {
    await seedOrder();
    await seedOrder();

    expect(await reportService.getTotalOrders()).toBe(2);
    expect(await reportService.getTotalProducts()).toBe(2);
    expect(await reportService.getTotalCategories()).toBe(2);
  });
});
