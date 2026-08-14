const crypto = require("crypto");
const mongoose = require("mongoose");
const { startTestDb } = require("../setup/testDb");

const RAZORPAY_SECRET = "test-secret";
process.env.RAZORPAY_KEY_SECRET = RAZORPAY_SECRET;
process.env.RAZORPAY_KEY_ID = "test-key";

// Razorpay is the one outside-world call in this module.
jest.mock("../../src/shared/config/razorpay", () => ({
  getRazorpay: () => ({
    orders: {
      create: jest.fn(async ({ amount }) => ({ id: "order_retry_123", amount })),
    },
  }),
}));

const paymentService = require("../../src/modules/payment/payment.service");
const adminOrdersService = require("../../src/modules/admin/adminOrders.service");
const User = require("../../src/modules/user/userSchema");
const Order = require("../../src/modules/order/orderSchema");
const Cart = require("../../src/modules/cart/cartSchema");
const Product = require("../../src/modules/product/productSchema");
const Category = require("../../src/modules/category/categorySchema");
const Address = require("../../src/modules/address/addressSchema");
const Transaction = require("../../src/modules/payment/transactionSchema");

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

async function seedOrder({ stock = 5, quantity = 1, paymentMethod = "RazorPay" } = {}) {
  seq += 1;
  const category = await Category.create({ name: `Caps${seq}`, description: "d" });
  const product = await Product.create({
    productName: `Cap${seq}`,
    description: "d",
    brand: "Acme",
    category: category._id,
    regularPrice: 500,
    salePrice: 400,
    productImage: ["i.jpg"],
    variants: [{ color: "Black", size: "ONESIZE", quantity: stock }],
  });
  const user = await User.create({ name: "T", email: `pay${seq}@svc.com` });
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
  const cart = await Cart.create({
    userId: user._id,
    items: [
      {
        productId: product._id,
        productName: product.productName,
        productImage: "i.jpg",
        variant: { color: "Black", size: "ONESIZE" },
        quantity,
        salePrice: 400,
        regularPrice: 500,
        totalPrice: 400 * quantity,
      },
    ],
  });
  user.cart = [cart._id];
  await user.save();

  const order = await Order.create({
    userId: user._id,
    orderNumber: `PAY-${seq}-${new mongoose.Types.ObjectId()}`,
    shippingAddress: address._id,
    items: [
      {
        productId: product._id,
        productName: product.productName,
        productImage: "i.jpg",
        variant: { color: "Black", size: "ONESIZE" },
        quantity,
        salePrice: 400,
        regularPrice: 500,
        totalPrice: 400 * quantity,
        orderStatus: "Placed",
      },
    ],
    subtotal: 400 * quantity,
    shipping: 40,
    total: 400 * quantity + 40,
    grandTotal: 400 * quantity + 40,
    paymentMethod,
  });

  return { user, order, product, cart };
}

const signatureFor = (razorpayOrderId, paymentId) =>
  crypto
    .createHmac("sha256", RAZORPAY_SECRET)
    .update(`${razorpayOrderId}|${paymentId}`)
    .digest("hex");

describe("payment endpoints are scoped to the order's owner", () => {
  test("another customer cannot read the receipt for someone else's order", async () => {
    const { order } = await seedOrder();
    const attacker = await User.create({ name: "X", email: "attacker@pay.com" });

    await expect(
      paymentService.getOrderForReceipt({
        userId: attacker._id.toString(),
        orderId: order._id.toString(),
      })
    ).rejects.toMatchObject({ isAppError: true, status: 404, message: "Order not found" });
  });

  test("another customer cannot look an order up by its number", async () => {
    const { order } = await seedOrder();
    const attacker = await User.create({ name: "X", email: "attacker2@pay.com" });

    await expect(
      paymentService.getOrderByNumber({
        userId: attacker._id.toString(),
        orderNumber: order.orderNumber,
      })
    ).rejects.toMatchObject({ status: 404 });
  });

  test("another customer cannot fail someone else's order or wipe their cart", async () => {
    const { user, order, cart } = await seedOrder();
    const attacker = await User.create({ name: "X", email: "attacker3@pay.com" });

    await expect(
      paymentService.recordPaymentFailure({
        userId: attacker._id.toString(),
        orderId: order._id.toString(),
        reason: "hijack",
      })
    ).rejects.toMatchObject({ status: 404, message: "Order not found." });

    expect((await Order.findById(order._id)).paymentStatus).not.toBe("Failed");
    expect(await Cart.findById(cart._id)).not.toBeNull();
    expect((await User.findById(user._id)).cart).toHaveLength(1);
  });

  test("another customer cannot retry someone else's payment", async () => {
    const { order } = await seedOrder();
    const attacker = await User.create({ name: "X", email: "attacker4@pay.com" });

    await expect(
      paymentService.retryPayment({
        userId: attacker._id.toString(),
        orderNumber: order.orderNumber,
      })
    ).rejects.toMatchObject({ status: 404 });
  });

  test("another customer cannot confirm someone else's payment, even with a valid signature", async () => {
    const { order, product } = await seedOrder();
    const attacker = await User.create({ name: "X", email: "attacker5@pay.com" });

    await expect(
      paymentService.confirmRetriedPayment({
        userId: attacker._id.toString(),
        orderNumber: order.orderNumber,
        paymentId: "pay_1",
        razorpayOrderId: "order_1",
        razorpaySignature: signatureFor("order_1", "pay_1"),
        items: [
          { productId: product._id, variant: { size: "ONESIZE", color: "Black" }, quantity: 1 },
        ],
      })
    ).rejects.toMatchObject({ status: 404 });

    expect((await Product.findById(product._id)).variants[0].quantity).toBe(5);
  });
});

describe("paymentService.getOrderForReceipt", () => {
  test("the owner gets their order back with the address populated", async () => {
    const { user, order } = await seedOrder();

    const res = await paymentService.getOrderForReceipt({
      userId: user._id.toString(),
      orderId: order._id.toString(),
    });

    expect(res.order.orderNumber).toBe(order.orderNumber);
    expect(res.order.shippingAddress.city).toBe("Chennai");
    expect(res.user.email).toBe(user.email);
  });
});

describe("paymentService.recordPaymentFailure", () => {
  test("marks the order failed and clears the owner's cart", async () => {
    const { user, order, cart } = await seedOrder();

    const { clearSessionCoupon, result } = await paymentService.recordPaymentFailure({
      userId: user._id.toString(),
      orderId: order._id.toString(),
      paymentId: "pay_fail",
      razorpayOrderId: "order_fail",
      reason: "card declined",
      description: "insufficient funds",
    });

    expect(clearSessionCoupon).toBe(true);
    expect(result.message).toMatch(/failure recorded/i);

    const saved = await Order.findById(order._id);
    expect(saved.paymentStatus).toBe("Failed");
    expect(saved.items[0].orderStatus).toBe("Failed");
    expect(saved.paymentDetails.failureReason).toBe("card declined");

    expect(await Cart.findById(cart._id)).toBeNull();
    expect((await User.findById(user._id)).cart).toHaveLength(0);
  });
});

describe("paymentService.retryPayment", () => {
  test("opens a new Razorpay order for the right amount", async () => {
    const { user, order } = await seedOrder();

    const res = await paymentService.retryPayment({
      userId: user._id.toString(),
      orderNumber: order.orderNumber,
    });

    // 440 rupees in paise.
    expect(res.amount).toBe(44000);
    expect(res.orderId).toBe("order_retry_123");
    expect((await Order.findById(order._id)).razorpayOrderId).toBe("order_retry_123");
  });

  test("refuses when stock ran out between the failure and the retry", async () => {
    const { user, order, product } = await seedOrder({ stock: 5, quantity: 3 });
    await Product.updateOne(
      { _id: product._id, "variants.color": "Black" },
      { $set: { "variants.$.quantity": 1 } }
    );

    await expect(
      paymentService.retryPayment({ userId: user._id.toString(), orderNumber: order.orderNumber })
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/Insufficient stock/),
    });
  });

  test("requires an order number", async () => {
    const { user } = await seedOrder();

    await expect(
      paymentService.retryPayment({ userId: user._id.toString(), orderNumber: undefined })
    ).rejects.toMatchObject({ status: 400, message: "orderId is required" });
  });
});

describe("paymentService.confirmRetriedPayment", () => {
  test("a forged signature is rejected and nothing is written", async () => {
    const { user, order, product } = await seedOrder();

    await expect(
      paymentService.confirmRetriedPayment({
        userId: user._id.toString(),
        orderNumber: order.orderNumber,
        paymentId: "pay_1",
        razorpayOrderId: "order_1",
        razorpaySignature: "not-the-real-signature",
        items: [
          { productId: product._id, variant: { size: "ONESIZE", color: "Black" }, quantity: 1 },
        ],
      })
    ).rejects.toMatchObject({ status: 400, message: /Invalid payment signature/ });

    expect((await Order.findById(order._id)).paymentStatus).not.toBe("Completed");
    expect((await Product.findById(product._id)).variants[0].quantity).toBe(5);
  });

  test("a valid signature completes the order and decrements stock", async () => {
    const { user, order, product } = await seedOrder();

    const res = await paymentService.confirmRetriedPayment({
      userId: user._id.toString(),
      orderNumber: order.orderNumber,
      paymentId: "pay_ok",
      razorpayOrderId: "order_ok",
      razorpaySignature: signatureFor("order_ok", "pay_ok"),
      items: [
        { productId: product._id, variant: { size: "ONESIZE", color: "Black" }, quantity: 2 },
      ],
    });

    expect(res.message).toMatch(/updated successfully/i);

    const saved = await Order.findById(order._id);
    expect(saved.paymentStatus).toBe("Completed");
    expect(saved.items[0].orderStatus).toBe("Placed");
    expect((await Product.findById(product._id)).variants[0].quantity).toBe(3);
  });

  test("missing fields are a 400 before any signature work", async () => {
    const { user, order } = await seedOrder();

    await expect(
      paymentService.confirmRetriedPayment({
        userId: user._id.toString(),
        orderNumber: order.orderNumber,
        paymentId: "pay_1",
      })
    ).rejects.toMatchObject({ status: 400, message: /are required/ });
  });
});

describe("adminOrdersService.updateOrderItemStatus", () => {
  const transitionArgs = (order, newStatus) => ({
    orderId: order._id.toString(),
    productSize: "ONESIZE",
    productColor: "Black",
    newStatus,
  });

  test("walks the happy path and marks COD paid on delivery", async () => {
    const { order } = await seedOrder({ paymentMethod: "COD" });

    await adminOrdersService.updateOrderItemStatus(transitionArgs(order, "Shipped"));
    await adminOrdersService.updateOrderItemStatus(transitionArgs(order, "Delivered"));

    const saved = await Order.findById(order._id);
    expect(saved.items[0].orderStatus).toBe("Delivered");
    expect(saved.paymentStatus).toBe("Completed");
  });

  test("refuses a transition the state machine does not allow", async () => {
    const { order } = await seedOrder();

    await expect(
      adminOrdersService.updateOrderItemStatus(transitionArgs(order, "Delivered"))
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/Cannot change status from "Placed" to "Delivered"/),
    });
  });

  test("refunds once on return, and cannot be re-run to refund twice", async () => {
    const { user, order, product } = await seedOrder({ paymentMethod: "COD" });

    await adminOrdersService.updateOrderItemStatus(transitionArgs(order, "Shipped"));
    await adminOrdersService.updateOrderItemStatus(transitionArgs(order, "Delivered"));
    await adminOrdersService.updateOrderItemStatus(transitionArgs(order, "Return requested"));

    const { refundAmount } = await adminOrdersService.updateOrderItemStatus(
      transitionArgs(order, "Returned")
    );

    expect(refundAmount).toBeGreaterThan(0);
    expect((await User.findById(user._id)).wallet).toBe(refundAmount);
    expect(await Transaction.countDocuments({ userId: user._id, type: "credit" })).toBe(1);
    // Stock came back.
    expect((await Product.findById(product._id)).variants[0].quantity).toBe(6);
    expect((await Order.findById(order._id)).items[0].returnedAt).toBeInstanceOf(Date);

    // Returned is terminal — a second attempt must not refund again.
    await expect(
      adminOrdersService.updateOrderItemStatus(transitionArgs(order, "Returned"))
    ).rejects.toMatchObject({ status: 400 });

    expect((await User.findById(user._id)).wallet).toBe(refundAmount);
    expect(await Transaction.countDocuments({ userId: user._id, type: "credit" })).toBe(1);
  });

  test("rejects an unknown status, order and variant", async () => {
    const { order } = await seedOrder();

    await expect(
      adminOrdersService.updateOrderItemStatus(transitionArgs(order, "Teleported"))
    ).rejects.toMatchObject({ status: 400, message: "Invalid status provided" });

    await expect(
      adminOrdersService.updateOrderItemStatus({
        ...transitionArgs(order, "Shipped"),
        orderId: new mongoose.Types.ObjectId().toString(),
      })
    ).rejects.toMatchObject({ status: 404, message: "Order not found" });

    await expect(
      adminOrdersService.updateOrderItemStatus({
        ...transitionArgs(order, "Shipped"),
        productColor: "Chartreuse",
      })
    ).rejects.toMatchObject({ status: 404, message: "Product not found in order" });
  });

  test("cancelling does not mark the order paid", async () => {
    const { order } = await seedOrder({ paymentMethod: "COD" });

    await adminOrdersService.updateOrderItemStatus(transitionArgs(order, "canceled"));

    const saved = await Order.findById(order._id);
    expect(saved.items[0].orderStatus).toBe("canceled");
    expect(saved.paymentStatus).not.toBe("Completed");
    expect(saved.items[0].canceledAt).toBeInstanceOf(Date);
  });
});

describe("adminOrdersService.listOrders", () => {
  test("paginates and attaches live financials", async () => {
    for (let i = 0; i < 7; i++) await seedOrder();

    const page1 = await adminOrdersService.listOrders({ page: 1 });
    expect(page1.orders).toHaveLength(5);
    expect(page1.totalPages).toBe(2);
    expect(page1.orders[0].financials).toBeDefined();

    expect((await adminOrdersService.listOrders({ page: 2 })).orders).toHaveLength(2);
  });

  test("search finds orders by order number and by customer", async () => {
    const { order, user } = await seedOrder();
    await seedOrder();

    const byNumber = await adminOrdersService.listOrders({ search: order.orderNumber });
    expect(byNumber.orders).toHaveLength(1);

    // Matching on the customer used to need a $lookup the query never did,
    // and matching an ObjectId _id by regex threw outright.
    const byEmail = await adminOrdersService.listOrders({ search: user.email });
    expect(byEmail.orders).toHaveLength(1);
    expect(byEmail.orders[0].orderNumber).toBe(order.orderNumber);
  });

  test("a search matching nothing returns an empty page, not an error", async () => {
    await seedOrder();

    await expect(
      adminOrdersService.listOrders({ search: "zzzz-no-such-thing" })
    ).resolves.toMatchObject({ orders: [], totalPages: 0 });
  });
});

describe("adminOrdersService.getOrderDetails", () => {
  test("returns the order, the chosen item and the financials", async () => {
    const { order } = await seedOrder();
    const itemId = order.items[0]._id.toString();

    const res = await adminOrdersService.getOrderDetails({
      orderId: order._id.toString(),
      itemId,
    });

    expect(res.orderItem._id.toString()).toBe(itemId);
    expect(res.order.shippingAddress.city).toBe("Chennai");
    expect(res.financials).toBeDefined();
  });

  test("404s on an unknown order or item", async () => {
    const { order } = await seedOrder();

    await expect(
      adminOrdersService.getOrderDetails({
        orderId: new mongoose.Types.ObjectId().toString(),
        itemId: "x",
      })
    ).rejects.toMatchObject({ status: 404, message: "Order not found" });

    await expect(
      adminOrdersService.getOrderDetails({
        orderId: order._id.toString(),
        itemId: new mongoose.Types.ObjectId().toString(),
      })
    ).rejects.toMatchObject({ status: 404, message: "Order item not found" });
  });
});
