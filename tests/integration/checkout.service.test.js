const mongoose = require("mongoose");
const { startTestDb } = require("../setup/testDb");
const checkoutService = require("../../src/modules/checkout/checkout.service");
const cartService = require("../../src/modules/cart/cart.service");
const User = require("../../src/modules/user/userSchema");
const Cart = require("../../src/modules/cart/cartSchema");
const Product = require("../../src/modules/product/productSchema");
const Category = require("../../src/modules/category/categorySchema");
const Brand = require("../../src/modules/brand/brandSchema");
const Address = require("../../src/modules/address/addressSchema");
// Registered for its side effect only: loadStorefrontContext populates the
// user's wishlist, and Mongoose needs the model on the connection.
require("../../src/modules/wishlist/wishlistSchema");

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

async function seedCatalog({ stock = 5 } = {}) {
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
    variants: [
      { color: "Black", size: "ONESIZE", quantity: stock },
      { color: "Red", size: "ONESIZE", quantity: stock },
    ],
  });
  return { category, brand, product };
}

async function seedShopper({ email, stock = 5, quantity = 1, withAddress = true } = {}) {
  const { category, brand, product } = await seedCatalog({ stock });
  const user = await User.create({ name: "T", email });
  await cartService.addToCart({
    userId: user._id.toString(),
    productId: product._id.toString(),
    size: "ONESIZE",
    color: "Black",
    quantity,
  });
  if (withAddress) {
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
    // Checkout reads the address list off the user, so the back-reference
    // has to exist — creating the Address alone is not enough.
    await User.updateOne({ _id: user._id }, { $addToSet: { addresses: address._id } });
  }
  return { user, product, category, brand };
}

describe("checkoutService.getCheckoutPage", () => {
  test("blocks a guest with a login redirect in the payload", async () => {
    await expect(
      checkoutService.getCheckoutPage({ userId: null, sessionCoupon: null })
    ).rejects.toMatchObject({
      isAppError: true,
      status: 401,
      message: "Please log in",
      details: { redirect: "/login" },
    });
  });

  test("blocks an empty cart with a cart redirect", async () => {
    const user = await User.create({ name: "T", email: "empty@chk.com" });

    await expect(
      checkoutService.getCheckoutPage({ userId: user._id.toString(), sessionCoupon: null })
    ).rejects.toMatchObject({
      status: 400,
      message: "Your cart is empty",
      details: { redirect: "/cart" },
    });
  });

  test("prices the cart and signals the session coupon should be dropped", async () => {
    const { user } = await seedShopper({ email: "price@chk.com", quantity: 2 });

    const { clearSessionCoupon, result } = await checkoutService.getCheckoutPage({
      userId: user._id.toString(),
      sessionCoupon: null,
    });

    expect(clearSessionCoupon).toBe(true);
    expect(result.subtotal).toBe(800);
    expect(result.shipping).toBe(40);
    expect(result.discountAmount).toBe(0);
    expect(result.total).toBe(840);
    expect(result.products).toHaveLength(1);
    expect(result.addressCount).toBe(1);
  });

  test("applies a session coupon, clamped to its cap", async () => {
    const { user } = await seedShopper({ email: "coupon@chk.com", quantity: 2 });

    const { result } = await checkoutService.getCheckoutPage({
      userId: user._id.toString(),
      sessionCoupon: { code: "SAVE", discount: { calculatedAmount: 300, maxCap: 100 } },
    });

    expect(result.discountAmount).toBe(100);
    expect(result.total).toBe(740);
    expect(result.coupon.code).toBe("SAVE");
  });

  test("a discount larger than the bill never produces a negative total", async () => {
    const { user } = await seedShopper({ email: "free@chk.com" });

    const { result } = await checkoutService.getCheckoutPage({
      userId: user._id.toString(),
      sessionCoupon: { discount: { calculatedAmount: 99999 } },
    });

    expect(result.total).toBe(0);
  });

  test("a cart holding only newly-blocked products counts as empty", async () => {
    const { user, product } = await seedShopper({ email: "blocked@chk.com" });
    await Product.updateOne({ _id: product._id }, { isBlocked: true });

    await expect(
      checkoutService.getCheckoutPage({ userId: user._id.toString(), sessionCoupon: null })
    ).rejects.toMatchObject({ status: 400, message: "Your cart is empty" });
  });
});

describe("checkoutService.validateCartForCheckout", () => {
  test("passes a healthy cart and leaves it intact", async () => {
    const { user } = await seedShopper({ email: "ok@chk.com" });

    const res = await checkoutService.validateCartForCheckout(user._id.toString());

    expect(res.success).toBe(true);
    expect((await Cart.findOne({ userId: user._id })).items).toHaveLength(1);
  });

  test("reports an empty cart rather than throwing", async () => {
    const user = await User.create({ name: "T", email: "novalid@chk.com" });

    await expect(
      checkoutService.validateCartForCheckout(user._id.toString())
    ).resolves.toMatchObject({ success: false, message: "Your cart is empty" });
  });

  test("prunes a line that went out of stock and reports it", async () => {
    const { user, product } = await seedShopper({ email: "oos@chk.com", quantity: 3 });
    await Product.updateOne(
      { _id: product._id, "variants.color": "Black" },
      { $set: { "variants.$.quantity": 1 } }
    );

    const res = await checkoutService.validateCartForCheckout(user._id.toString());

    expect(res.success).toBe(false);
    expect(res.outOfStockItems).toHaveLength(1);
    expect(res.outOfStockItems[0]).toMatchObject({
      availableStock: 1,
      requestedQuantity: 3,
      message: "Only 1 items available",
    });
    expect((await Cart.findOne({ userId: user._id })).items).toHaveLength(0);
  });

  test("reports a blocked brand with a reason", async () => {
    const { user } = await seedShopper({ email: "brand@chk.com" });
    await Brand.updateOne({ brandName: "Acme" }, { isBlocked: true });

    const res = await checkoutService.validateCartForCheckout(user._id.toString());

    expect(res.success).toBe(false);
    expect(res.blockedItems[0].reason).toMatch(/Brand "Acme" is blocked/);
  });

  test("reports an unlisted category with a reason", async () => {
    const { user } = await seedShopper({ email: "cat@chk.com" });
    await Category.updateOne({ name: "Caps" }, { isListed: false });

    const res = await checkoutService.validateCartForCheckout(user._id.toString());

    expect(res.blockedItems[0].reason).toMatch(/Category "Caps" is blocked/);
  });

  test("prunes only the bad variant, keeping the good one from the same product", async () => {
    const { user, product } = await seedShopper({ email: "mixed@chk.com" });
    await cartService.addToCart({
      userId: user._id.toString(),
      productId: product._id.toString(),
      size: "ONESIZE",
      color: "Red",
      quantity: 1,
    });

    // Only Black sells out. Matching on productId alone would have let it
    // survive, because Red on the same product is still buyable.
    await Product.updateOne(
      { _id: product._id, "variants.color": "Black" },
      { $set: { "variants.$.quantity": 0 } }
    );

    const res = await checkoutService.validateCartForCheckout(user._id.toString());

    expect(res.success).toBe(false);
    expect(res.outOfStockItems).toHaveLength(1);
    expect(res.outOfStockItems[0]).toMatchObject({ color: "Black", message: "Out of stock" });

    const remaining = (await Cart.findOne({ userId: user._id })).items;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].variant.color).toBe("Red");
  });

  test("reports a product that has since been deleted", async () => {
    const { user, product } = await seedShopper({ email: "deleted@chk.com" });
    await Product.deleteOne({ _id: product._id });

    const res = await checkoutService.validateCartForCheckout(user._id.toString());

    expect(res.outOfStockItems[0]).toMatchObject({
      productName: "Unknown Product",
      message: "Product no longer exists",
    });
    expect((await Cart.findOne({ userId: user._id })).items).toHaveLength(0);
  });
});
