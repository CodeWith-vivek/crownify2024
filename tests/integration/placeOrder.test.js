const mongoose = require("mongoose");
const { startTestDb } = require("../setup/testDb");
const { mockRes } = require("../setup/mockRes");
const { placeOrder } = require("../../src/modules/order/placeOrder.controller");
const User = require("../../src/modules/user/userSchema");
const Cart = require("../../src/modules/cart/cartSchema");
const Product = require("../../src/modules/product/productSchema");
const Category = require("../../src/modules/category/categorySchema");
const Brand = require("../../src/modules/brand/brandSchema");
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

function reqFor(userId, body = {}, session = {}) {
  return {
    session: { user: userId, ...session },
    body: { subtotal: 400, shipping: 40, paymentMethod: "COD", ...body },
  };
}

async function seedCatalog() {
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
    variants: [{ color: "Black", size: "ONESIZE", quantity: 5 }],
  });
  return { category, brand, product };
}

function cartItemFor(product) {
  return {
    productId: product._id,
    productName: product.productName,
    variant: { color: "Black", size: "ONESIZE" },
    quantity: 1,
    productImage: "img.jpg",
    regularPrice: 500,
    salePrice: 400,
    totalPrice: 400,
  };
}

// These three paths all used to reference `cart` before its own const
// declaration (and `cartItem`, a loop variable that didn't exist in scope),
// so instead of the intended 4xx they threw
// "ReferenceError: Cannot access 'cart' before initialization", which the
// outer catch turned into a generic 500 "Error placing order".
describe("placeOrder — early validation paths (temporal-dead-zone regression)", () => {
  test("unknown user returns 404 with its intended message, not a 500", async () => {
    const res = mockRes();
    await placeOrder(reqFor(new mongoose.Types.ObjectId().toString()), res);

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("User not found");
  });

  test("empty cart returns 404 with its intended message, not a 500", async () => {
    const user = await User.create({ name: "T", email: "empty@test.com" });

    const res = mockRes();
    await placeOrder(reqFor(user._id.toString()), res);

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("No items in the cart to proceed");
  });

  test("coupon that no longer exists returns 400 with its intended message, not a 500", async () => {
    const user = await User.create({ name: "T", email: "coupon@test.com" });

    const res = mockRes();
    await placeOrder(
      reqFor(user._id.toString(), {}, { coupon: { code: "GONE", temporary: true } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/no longer valid/i);
  });
});

describe("placeOrder — COD happy path", () => {
  test("creates the order, decrements stock, and clears the cart", async () => {
    const { product } = await seedCatalog();
    const user = await User.create({ name: "T", email: "cod@test.com" });
    const cart = await Cart.create({ userId: user._id, items: [cartItemFor(product)] });
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

    const res = mockRes();
    await placeOrder(reqFor(user._id.toString(), { primaryAddressId: address._id.toString() }), res);

    expect(res.body.success).toBe(true);
    expect(res.body.orderId).toBeTruthy();

    // Stock drawn down from 5 to 4
    const updatedProduct = await Product.findById(product._id);
    expect(updatedProduct.variants[0].quantity).toBe(4);

    // Cart document deleted and unlinked from the user
    expect(await Cart.findById(cart._id)).toBeNull();
    const updatedUser = await User.findById(user._id);
    expect(updatedUser.cart).toHaveLength(0);
  });

  test("rejects when the ordered quantity exceeds stock, leaving stock untouched", async () => {
    const { product } = await seedCatalog();
    const user = await User.create({ name: "T", email: "stock@test.com" });
    const item = cartItemFor(product);
    item.quantity = 99; // only 5 in stock
    const cart = await Cart.create({ userId: user._id, items: [item] });
    user.cart = [cart._id];
    await user.save();

    const res = mockRes();
    await placeOrder(reqFor(user._id.toString()), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/insufficient stock/i);

    const updatedProduct = await Product.findById(product._id);
    expect(updatedProduct.variants[0].quantity).toBe(5);
  });

  test("unsupported payment method returns 400 instead of hanging", async () => {
    const { product } = await seedCatalog();
    const user = await User.create({ name: "T", email: "pm@test.com" });
    const cart = await Cart.create({ userId: user._id, items: [cartItemFor(product)] });
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

    const res = mockRes();
    await placeOrder(
      reqFor(user._id.toString(), {
        primaryAddressId: address._id.toString(),
        paymentMethod: "Bitcoin",
      }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/unsupported payment method/i);
  });
});
