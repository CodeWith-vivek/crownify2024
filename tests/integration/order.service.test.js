const mongoose = require("mongoose");
const { startTestDb } = require("../setup/testDb");
const orderService = require("../../src/modules/order/order.service");
const User = require("../../src/modules/user/userSchema");
const Cart = require("../../src/modules/cart/cartSchema");
const Order = require("../../src/modules/order/orderSchema");
const Product = require("../../src/modules/product/productSchema");
const Category = require("../../src/modules/category/categorySchema");
const Brand = require("../../src/modules/brand/brandSchema");
const Address = require("../../src/modules/address/addressSchema");
const Transaction = require("../../src/modules/payment/transactionSchema");

// These exercise the SAME rules as placeOrder.test.js, but by calling the
// service directly — no req/res mock, no HTTP shape to assert against.
// Failures are asserted as thrown AppErrors carrying their own status,
// which is the point of pulling the logic out of the controller: the
// rules are testable without pretending to be Express.

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

async function seedCatalog(stock = 5) {
  const category = await Category.create({ name: "Caps", description: "Caps" });
  const brand = await Brand.create({ brandName: "Acme", brandImage: ["b.png"] });
  const product = await Product.create({
    productName: "Snapback",
    description: "A cap",
    brand: brand.brandName,
    category: category._id,
    regularPrice: 500,
    salePrice: 400,
    productImage: ["img.jpg"],
    variants: [{ color: "Black", size: "ONESIZE", quantity: stock }],
  });
  return { category, brand, product };
}

function cartItemFor(product, quantity = 1) {
  return {
    productId: product._id,
    productName: product.productName,
    variant: { color: "Black", size: "ONESIZE" },
    quantity,
    productImage: "img.jpg",
    regularPrice: 500,
    salePrice: 400,
    totalPrice: 400 * quantity,
  };
}

async function seedShopper({ wallet = 0, stock = 5, quantity = 1, email } = {}) {
  const { product } = await seedCatalog(stock);
  const user = await User.create({ name: "T", email, wallet });
  const cart = await Cart.create({ userId: user._id, items: [cartItemFor(product, quantity)] });
  user.cart = [cart._id];
  await user.save();
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
  return { user, cart, product, address };
}

const baseArgs = (user, address, overrides = {}) => ({
  userId: user._id.toString(),
  primaryAddressId: address?._id?.toString(),
  subtotal: 400,
  shipping: 40,
  paymentMethod: "COD",
  sessionCoupon: null,
  ...overrides,
});

describe("orderService.placeOrder — failures surface as AppError with a status", () => {
  test("unknown user", async () => {
    await expect(
      orderService.placeOrder(baseArgs({ _id: new mongoose.Types.ObjectId() }, null))
    ).rejects.toMatchObject({ isAppError: true, status: 404, message: "User not found" });
  });

  test("empty cart, and it signals the coupon should be dropped", async () => {
    const user = await User.create({ name: "T", email: "empty@svc.com" });

    await expect(
      orderService.placeOrder(baseArgs(user, null))
    ).rejects.toMatchObject({
      status: 404,
      message: "No items in the cart to proceed",
      meta: { clearSessionCoupon: true },
    });
  });

  test("stale coupon", async () => {
    const user = await User.create({ name: "T", email: "coupon@svc.com" });

    await expect(
      orderService.placeOrder(
        baseArgs(user, null, { sessionCoupon: { code: "GONE", temporary: true } })
      )
    ).rejects.toMatchObject({ status: 400, meta: { clearSessionCoupon: true } });
  });

  test("insufficient stock leaves stock untouched", async () => {
    const { user, address, product } = await seedShopper({
      stock: 5,
      quantity: 99,
      email: "stock@svc.com",
    });

    await expect(orderService.placeOrder(baseArgs(user, address))).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/insufficient stock/i),
    });

    expect((await Product.findById(product._id)).variants[0].quantity).toBe(5);
  });

  test("missing address does NOT drop the coupon — the cart is still valid", async () => {
    const { user } = await seedShopper({ email: "addr@svc.com" });

    await expect(
      orderService.placeOrder(
        baseArgs(user, { _id: new mongoose.Types.ObjectId() })
      )
    ).rejects.toMatchObject({
      status: 404,
      message: "Primary address not found",
      meta: {},
    });
  });

  test("unsupported payment method", async () => {
    const { user, address } = await seedShopper({ email: "pm@svc.com" });

    await expect(
      orderService.placeOrder(baseArgs(user, address, { paymentMethod: "Bitcoin" }))
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/unsupported payment method/i),
    });
  });
});

describe("orderService.placeOrder — success paths", () => {
  test("COD: creates the order, decrements stock, clears the cart, signals coupon clear", async () => {
    const { user, address, product, cart } = await seedShopper({ email: "cod@svc.com" });

    const { clearSessionCoupon, result } = await orderService.placeOrder(baseArgs(user, address));

    expect(clearSessionCoupon).toBe(true);
    expect(result.orderId).toBeTruthy();
    expect((await Product.findById(product._id)).variants[0].quantity).toBe(4);
    expect(await Cart.findById(cart._id)).toBeNull();
    expect((await User.findById(user._id)).cart).toHaveLength(0);
  });

  test("Wallet: debits the balance and writes a debit transaction", async () => {
    const { user, address } = await seedShopper({ wallet: 1000, email: "wallet@svc.com" });

    const { result } = await orderService.placeOrder(
      baseArgs(user, address, { paymentMethod: "Wallet" })
    );

    // 400 subtotal + 40 shipping
    expect((await User.findById(user._id)).wallet).toBe(560);

    const txn = await Transaction.findOne({ userId: user._id });
    expect(txn.type).toBe("debit");
    expect(txn.amount).toBe(440);

    const order = await Order.findById(result.orderId);
    expect(order.paymentStatus).toBe("Completed");
  });

  test("Wallet: rejects when the balance can't cover the total", async () => {
    const { user, address } = await seedShopper({ wallet: 10, email: "poor@svc.com" });

    await expect(
      orderService.placeOrder(baseArgs(user, address, { paymentMethod: "Wallet" }))
    ).rejects.toMatchObject({ status: 400, message: "Insufficient wallet balance" });

    // Balance untouched by the failed attempt.
    expect((await User.findById(user._id)).wallet).toBe(10);
  });
});

describe("orderService — post-purchase changes", () => {
  async function placedCodOrder(email) {
    const { user, address, product } = await seedShopper({ email });
    const { result } = await orderService.placeOrder(baseArgs(user, address));
    return { user, product, orderId: result.orderId };
  }

  test("cancelOrderItem restores stock and marks the line canceled", async () => {
    const { user, product, orderId } = await placedCodOrder("cancel@svc.com");
    const order = await Order.findById(orderId);

    const res = await orderService.cancelOrderItem({
      userId: user._id.toString(),
      orderNumber: order.orderNumber,
      productSize: "ONESIZE",
      productColor: "Black",
    });

    expect(res.message).toMatch(/canceled successfully/i);
    // 5 -> 4 on purchase -> back to 5 on cancel
    expect((await Product.findById(product._id)).variants[0].quantity).toBe(5);
    expect((await Order.findById(orderId)).items[0].orderStatus).toBe("canceled");

    // COD collected nothing, so no wallet refund.
    expect((await User.findById(user._id)).wallet).toBe(0);
  });

  test("cancelling twice is rejected", async () => {
    const { user, orderId } = await placedCodOrder("twice@svc.com");
    const order = await Order.findById(orderId);
    const args = {
      userId: user._id.toString(),
      orderNumber: order.orderNumber,
      productSize: "ONESIZE",
      productColor: "Black",
    };

    await orderService.cancelOrderItem(args);

    await expect(orderService.cancelOrderItem(args)).rejects.toMatchObject({
      status: 400,
      message: "This item is already canceled",
    });
  });

  test("another user cannot touch someone else's order", async () => {
    const { orderId } = await placedCodOrder("owner@svc.com");
    const order = await Order.findById(orderId);
    const attacker = await User.create({ name: "X", email: "attacker@svc.com" });

    await expect(
      orderService.cancelOrderItem({
        userId: attacker._id.toString(),
        orderNumber: order.orderNumber,
        productSize: "ONESIZE",
        productColor: "Black",
      })
    ).rejects.toMatchObject({ status: 404, message: "Order not found" });

    expect((await Order.findById(orderId)).items[0].orderStatus).not.toBe("canceled");
  });

  test("cancelReturnRequest requires a return actually in flight", async () => {
    const { user, orderId } = await placedCodOrder("noreturn@svc.com");
    const order = await Order.findById(orderId);

    await expect(
      orderService.cancelReturnRequest({
        userId: user._id.toString(),
        orderNumber: order.orderNumber,
        productSize: "ONESIZE",
        productColor: "Black",
      })
    ).rejects.toMatchObject({
      status: 400,
      message: "This item has no pending return request to cancel",
    });
  });

  test("requestReturn then cancelReturnRequest round-trips back to Delivered", async () => {
    const { user, orderId } = await placedCodOrder("return@svc.com");
    const order = await Order.findById(orderId);
    const args = {
      userId: user._id.toString(),
      orderNumber: order.orderNumber,
      productSize: "ONESIZE",
      productColor: "Black",
    };

    await orderService.requestReturn(args);
    expect((await Order.findById(orderId)).items[0].orderStatus).toBe("Return requested");

    await orderService.cancelReturnRequest(args);
    expect((await Order.findById(orderId)).items[0].orderStatus).toBe("Delivered");
  });
});
