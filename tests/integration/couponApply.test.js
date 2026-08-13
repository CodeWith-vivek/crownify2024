const { startTestDb } = require("../setup/testDb");
const { couponApply } = require("../../src/modules/coupon/couponController");
const Coupon = require("../../src/modules/coupon/couponSchema");

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

function mockRes() {
  const res = { statusCode: 200 };
  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((payload) => {
    res.body = payload;
    return res;
  });
  return res;
}

function futureDate(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

describe("couponApply", () => {
  test("rejects when cart total is below minPurchase", async () => {
    await Coupon.create({
      code: "SAVE20",
      discountType: "percentage",
      discountAmount: 20,
      minPurchase: 1000,
      usageLimit: 0,
      expiryDate: futureDate(30),
    });
    const req = { body: { couponCode: "SAVE20", cartTotal: 500 }, session: { user: "u1" } };
    const res = mockRes();

    await couponApply(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/minimum purchase/i);
  });

  test("rejects an expired coupon", async () => {
    await Coupon.create({
      code: "OLD10",
      discountType: "fixed",
      discountAmount: 10,
      minPurchase: 0,
      usageLimit: 0,
      expiryDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });
    const req = { body: { couponCode: "OLD10", cartTotal: 1000 }, session: { user: "u1" } };
    const res = mockRes();

    await couponApply(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/expired/i);
  });

  test("percentage discount is capped at maxDiscount", async () => {
    await Coupon.create({
      code: "BIG50",
      discountType: "percentage",
      discountAmount: 50,
      maxDiscount: 200,
      minPurchase: 0,
      usageLimit: 0,
      expiryDate: futureDate(30),
    });
    // 50% of 2000 would be 1000, but the cap is 200.
    const req = { body: { couponCode: "BIG50", cartTotal: 2000 }, session: { user: "u1" } };
    const res = mockRes();

    await couponApply(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.discount.applied).toBe(200);
    expect(res.body.finalTotal).toBe(1800);
  });

  test("fixed discount applies the flat amount, not a percentage", async () => {
    await Coupon.create({
      code: "FLAT100",
      discountType: "fixed",
      discountAmount: 100,
      minPurchase: 0,
      usageLimit: 0,
      expiryDate: futureDate(30),
    });
    const req = { body: { couponCode: "FLAT100", cartTotal: 1000 }, session: { user: "u1" } };
    const res = mockRes();

    await couponApply(req, res);

    expect(res.body.discount.applied).toBe(100);
    expect(res.body.finalTotal).toBe(900);
  });

  test("rejects an unknown coupon code", async () => {
    const req = { body: { couponCode: "NOPE", cartTotal: 1000 }, session: { user: "u1" } };
    const res = mockRes();

    await couponApply(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/invalid or expired/i);
  });
});
