const mongoose = require("mongoose");
const { startTestDb } = require("../setup/testDb");
const { updateOrderStatusByAdmin } = require("../../src/modules/admin/adminController");
const Order = require("../../src/modules/order/orderSchema");
const Product = require("../../src/modules/product/productSchema");
const User = require("../../src/modules/user/userSchema");
const Category = require("../../src/modules/category/categorySchema");

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

async function seedOrderWithItem(orderStatus) {
  const category = await Category.create({ name: "Caps", description: "Caps" });
  const user = await User.create({ name: "Test User", email: `u${Date.now()}@test.com`, wallet: 0 });
  const product = await Product.create({
    productName: "Snapback",
    description: "A cap",
    brand: "Acme",
    category: category._id,
    regularPrice: 500,
    salePrice: 400,
    productImage: ["img.jpg"],
    variants: [{ color: "Black", size: "ONESIZE", quantity: 5 }],
  });
  const order = await Order.create({
    userId: user._id,
    shippingAddress: new mongoose.Types.ObjectId(),
    paymentMethod: "COD",
    subtotal: 400,
    total: 400,
    grandTotal: 440,
    discount: 0,
    shipping: 40,
    items: [
      {
        productId: product._id,
        productName: "Snapback",
        variant: { color: "Black", size: "ONESIZE" },
        quantity: 1,
        productImage: "img.jpg",
        orderStatus,
        regularPrice: 500,
        salePrice: 400,
        totalPrice: 400,
      },
    ],
  });
  return { order, user, product };
}

describe("updateOrderStatusByAdmin — state machine", () => {
  test("allows a valid forward transition (Placed -> Shipped)", async () => {
    const { order } = await seedOrderWithItem("Placed");
    const req = { body: { orderId: order._id.toString(), productSize: "ONESIZE", productColor: "Black", newStatus: "Shipped" } };
    const res = mockRes();

    await updateOrderStatusByAdmin(req, res);

    expect(res.body.success).toBe(true);
    const updated = await Order.findById(order._id);
    expect(updated.items[0].orderStatus).toBe("Shipped");
  });

  test("rejects skipping straight from Placed to Returned", async () => {
    const { order } = await seedOrderWithItem("Placed");
    const req = { body: { orderId: order._id.toString(), productSize: "ONESIZE", productColor: "Black", newStatus: "Returned" } };
    const res = mockRes();

    await updateOrderStatusByAdmin(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    const updated = await Order.findById(order._id);
    expect(updated.items[0].orderStatus).toBe("Placed");
  });

  test("rejects any transition out of a terminal state (Returned)", async () => {
    const { order } = await seedOrderWithItem("Returned");
    const req = { body: { orderId: order._id.toString(), productSize: "ONESIZE", productColor: "Black", newStatus: "Delivered" } };
    const res = mockRes();

    await updateOrderStatusByAdmin(req, res);

    expect(res.statusCode).toBe(400);
    const updated = await Order.findById(order._id);
    expect(updated.items[0].orderStatus).toBe("Returned");
  });

  test("Returned transition restocks inventory and credits the wallet exactly once", async () => {
    const { order, user, product } = await seedOrderWithItem("Return requested");
    const req = { body: { orderId: order._id.toString(), productSize: "ONESIZE", productColor: "Black", newStatus: "Returned" } };
    const res = mockRes();

    await updateOrderStatusByAdmin(req, res);

    expect(res.body.success).toBe(true);
    const updatedProduct = await Product.findById(product._id);
    expect(updatedProduct.variants[0].quantity).toBe(6); // 5 + 1 restocked

    const updatedUser = await User.findById(user._id);
    expect(updatedUser.wallet).toBe(400); // full item value, no discount to apportion

    const updatedOrder = await Order.findById(order._id);
    expect(updatedOrder.items[0].returnedAt).toBeTruthy();

    // Calling it again must be rejected by the terminal-state rule — a
    // second call previously double-refunded the wallet and double-restocked.
    const secondRes = mockRes();
    await updateOrderStatusByAdmin(req, secondRes);
    expect(secondRes.statusCode).toBe(400);
    const userAfterRetry = await User.findById(user._id);
    expect(userAfterRetry.wallet).toBe(400);
  });

  test("Delivered on COD marks paymentStatus Completed", async () => {
    const { order } = await seedOrderWithItem("Shipped");
    const req = { body: { orderId: order._id.toString(), productSize: "ONESIZE", productColor: "Black", newStatus: "Delivered" } };
    const res = mockRes();

    await updateOrderStatusByAdmin(req, res);

    const updated = await Order.findById(order._id);
    expect(updated.paymentStatus).toBe("Completed");
  });

  test("rejects an unknown status value", async () => {
    const { order } = await seedOrderWithItem("Placed");
    const req = { body: { orderId: order._id.toString(), productSize: "ONESIZE", productColor: "Black", newStatus: "Bogus" } };
    const res = mockRes();

    await updateOrderStatusByAdmin(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/invalid status/i);
  });
});
