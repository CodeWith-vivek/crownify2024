const mongoose = require("mongoose");
const { startTestDb } = require("../setup/testDb");
const couponService = require("../../src/modules/coupon/coupon.service");
const Coupon = require("../../src/modules/coupon/couponSchema");
const User = require("../../src/modules/user/userSchema");

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

const tomorrow = () => new Date(Date.now() + 86400000);
const yesterday = () => new Date(Date.now() - 86400000);

const seedCoupon = (overrides = {}) =>
  Coupon.create({
    code: "SAVE10",
    description: "10% off",
    discountType: "percentage",
    discountAmount: 10,
    maxDiscount: 500,
    minPurchase: 100,
    usageLimit: 1,
    expiryDate: tomorrow(),
    ...overrides,
  });

describe("couponService.applyCoupon", () => {
  test("a percentage coupon discounts and reports the new total", async () => {
    await seedCoupon();
    const user = await User.create({ name: "T", email: "pct@cpn.com" });

    const { result, sessionCoupon } = await couponService.applyCoupon({
      userId: user._id.toString(),
      couponCode: "SAVE10",
      cartTotal: 1000,
    });

    expect(result.discount.applied).toBe(100);
    expect(result.finalTotal).toBe(900);
    // Not committed yet — placeOrder records the usage.
    expect(sessionCoupon.temporary).toBe(true);
    expect(sessionCoupon.discount.calculatedAmount).toBe(100);
  });

  test("a percentage discount is capped by maxDiscount", async () => {
    await seedCoupon({ discountAmount: 50, maxDiscount: 200 });
    const user = await User.create({ name: "T", email: "cap@cpn.com" });

    const { result } = await couponService.applyCoupon({
      userId: user._id.toString(),
      couponCode: "SAVE10",
      cartTotal: 1000,
    });

    // 50% of 1000 is 500, capped at 200.
    expect(result.discount.applied).toBe(200);
    expect(result.finalTotal).toBe(800);
  });

  test("a fixed coupon takes off a flat amount", async () => {
    await seedCoupon({ discountType: "fixed", discountAmount: 250 });
    const user = await User.create({ name: "T", email: "fix@cpn.com" });

    const { result } = await couponService.applyCoupon({
      userId: user._id.toString(),
      couponCode: "SAVE10",
      cartTotal: 1000,
    });

    expect(result.discount.applied).toBe(250);
    expect(result.finalTotal).toBe(750);
  });

  test("a discount larger than the cart never goes negative", async () => {
    await seedCoupon({ discountType: "fixed", discountAmount: 9999 });
    const user = await User.create({ name: "T", email: "big@cpn.com" });

    const { result } = await couponService.applyCoupon({
      userId: user._id.toString(),
      couponCode: "SAVE10",
      cartTotal: 500,
    });

    expect(result.finalTotal).toBe(0);
  });

  test("rejections that should also drop an already-applied coupon say so", async () => {
    const user = await User.create({ name: "T", email: "bad@cpn.com" });
    const userId = user._id.toString();

    await expect(
      couponService.applyCoupon({ userId, couponCode: "", cartTotal: 100 })
    ).rejects.toMatchObject({ status: 400, meta: { clearSessionCoupon: true } });

    await expect(
      couponService.applyCoupon({ userId, couponCode: "NOPE", cartTotal: 100 })
    ).rejects.toMatchObject({
      message: "Invalid or expired coupon.",
      meta: { clearSessionCoupon: true },
    });

    await seedCoupon({ code: "GONE", expiryDate: yesterday() });
    await expect(
      couponService.applyCoupon({ userId, couponCode: "GONE", cartTotal: 1000 })
    ).rejects.toMatchObject({
      message: "This coupon has expired.",
      meta: { clearSessionCoupon: true },
    });

    await seedCoupon({ code: "BIGSPEND", minPurchase: 5000 });
    await expect(
      couponService.applyCoupon({ userId, couponCode: "BIGSPEND", cartTotal: 1000 })
    ).rejects.toMatchObject({
      message: expect.stringMatching(/Minimum purchase required/),
      meta: { clearSessionCoupon: true },
    });
  });

  test("an inactive coupon cannot be applied", async () => {
    await seedCoupon({ isActive: false });
    const user = await User.create({ name: "T", email: "off@cpn.com" });

    await expect(
      couponService.applyCoupon({
        userId: user._id.toString(),
        couponCode: "SAVE10",
        cartTotal: 1000,
      })
    ).rejects.toMatchObject({ message: "Invalid or expired coupon." });
  });

  test("hitting your usage limit does NOT clear an already-applied coupon", async () => {
    const user = await User.create({ name: "T", email: "used@cpn.com" });
    await seedCoupon({
      usageLimit: 1,
      users_applied: [{ user: user._id, used_count: 1 }],
    });

    const error = await couponService
      .applyCoupon({ userId: user._id.toString(), couponCode: "SAVE10", cartTotal: 1000 })
      .catch((e) => e);

    expect(error.status).toBe(400);
    expect(error.message).toMatch(/usage limit/);
    expect(error.meta.clearSessionCoupon).toBeUndefined();
  });

  test("usageLimit 0 means unlimited", async () => {
    const user = await User.create({ name: "T", email: "inf@cpn.com" });
    await seedCoupon({ usageLimit: 0, users_applied: [{ user: user._id, used_count: 99 }] });

    await expect(
      couponService.applyCoupon({
        userId: user._id.toString(),
        couponCode: "SAVE10",
        cartTotal: 1000,
      })
    ).resolves.toBeTruthy();
  });

  test("another customer's usage does not count against you", async () => {
    const owner = await User.create({ name: "A", email: "a@cpn.com" });
    const other = await User.create({ name: "B", email: "b@cpn.com" });
    await seedCoupon({ usageLimit: 1, users_applied: [{ user: owner._id, used_count: 1 }] });

    await expect(
      couponService.applyCoupon({
        userId: other._id.toString(),
        couponCode: "SAVE10",
        cartTotal: 1000,
      })
    ).resolves.toBeTruthy();
  });
});

describe("couponService.removeCoupon", () => {
  test("returns the cart to its undiscounted total", () => {
    expect(couponService.removeCoupon({ cartTotal: 900 })).toMatchObject({
      discount: 0,
      finalTotal: 900,
    });
  });

  test("rejects a negative total", () => {
    expect(() => couponService.removeCoupon({ cartTotal: -1 })).toThrow("Invalid input.");
  });
});

describe("couponService admin CRUD", () => {
  const newCouponBody = (overrides = {}) => ({
    code: "NEW20",
    discountType: "percentage",
    discountAmount: "20",
    maxDiscount: "300",
    minPurchase: "500",
    expiryDate: tomorrow().toISOString(),
    usageLimit: "2",
    description: "  spaced  ",
    ...overrides,
  });

  test("creates a coupon, coercing the numbers and trimming the description", async () => {
    const { coupon } = await couponService.createCoupon(newCouponBody());

    expect(coupon.discountAmount).toBe(20);
    expect(coupon.minPurchase).toBe(500);
    expect(coupon.usageLimit).toBe(2);
    expect(coupon.description).toBe("spaced");
  });

  test("rejects a duplicate code and a negative usage limit", async () => {
    await seedCoupon({ code: "TAKEN" });

    await expect(
      couponService.createCoupon(newCouponBody({ code: "TAKEN" }))
    ).rejects.toMatchObject({ status: 400, message: "Coupon code already exists" });

    await expect(
      couponService.createCoupon(newCouponBody({ usageLimit: -1 }))
    ).rejects.toMatchObject({ status: 400, message: "Usage limit must be 0 or greater." });
  });

  test("lists newest first", async () => {
    await seedCoupon({ code: "OLD" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await seedCoupon({ code: "NEW" });

    expect((await couponService.listCoupons()).map((c) => c.code)).toEqual(["NEW", "OLD"]);
  });

  test("fetches, updates and deletes by id", async () => {
    const coupon = await seedCoupon();
    const id = coupon._id.toString();

    expect((await couponService.getCoupon(id)).code).toBe("SAVE10");

    await couponService.updateCoupon({
      couponId: id,
      body: { couponCode: "RENAMED", discountAmount: 15, usageLimit: 5 },
    });
    expect((await Coupon.findById(id)).code).toBe("RENAMED");

    await couponService.deleteCoupon(id);
    expect(await Coupon.findById(id)).toBeNull();
  });

  test("404s on an unknown id for fetch, update and delete", async () => {
    const missing = new mongoose.Types.ObjectId().toString();

    await expect(couponService.getCoupon(missing)).rejects.toMatchObject({ status: 404 });
    await expect(
      couponService.updateCoupon({ couponId: missing, body: {} })
    ).rejects.toMatchObject({ status: 404 });
    await expect(couponService.deleteCoupon(missing)).rejects.toMatchObject({ status: 404 });
  });
});
