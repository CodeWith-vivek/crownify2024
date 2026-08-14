const mongoose = require("mongoose");
const { startTestDb } = require("../setup/testDb");
const cartService = require("../../src/modules/cart/cart.service");
const User = require("../../src/modules/user/userSchema");
const Cart = require("../../src/modules/cart/cartSchema");
const Product = require("../../src/modules/product/productSchema");
const Category = require("../../src/modules/category/categorySchema");
const Brand = require("../../src/modules/brand/brandSchema");
// Registered for its side effect only: loadStorefrontContext populates the
// user's wishlist, and Mongoose needs the model on the connection.
require("../../src/modules/wishlist/wishlistSchema");

// Cart rules exercised directly, with no req/res mock — the point of
// pulling them out of the controller. Failures are thrown AppErrors that
// carry their own status.

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

async function seedCatalog({ stock = 5, productBlocked = false, categoryListed = true, brandBlocked = false } = {}) {
  const category = await Category.create({
    name: "Caps",
    description: "Caps",
    isListed: categoryListed,
  });
  const brand = await Brand.create({
    brandName: "Acme",
    brandImage: ["b.png"],
    isBlocked: brandBlocked,
  });
  const product = await Product.create({
    productName: "Snapback",
    description: "A cap",
    brand: brand.brandName,
    category: category._id,
    regularPrice: 500,
    salePrice: 400,
    productImage: ["img.jpg"],
    isBlocked: productBlocked,
    variants: [
      { color: "Black", size: "ONESIZE", quantity: stock },
      { color: "Red", size: "ONESIZE", quantity: stock },
    ],
  });
  return { category, brand, product };
}

const addArgs = (user, product, overrides = {}) => ({
  userId: user._id.toString(),
  productId: product._id.toString(),
  size: "ONESIZE",
  color: "Black",
  quantity: 1,
  ...overrides,
});

describe("cartService.addToCart", () => {
  test("adds the line, links the cart to the user, and leaves stock alone", async () => {
    const { product } = await seedCatalog();
    const user = await User.create({ name: "T", email: "add@svc.com" });

    const { message, cart } = await cartService.addToCart(addArgs(user, product));

    expect(message).toMatch(/added to cart/i);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].totalPrice).toBe(400);

    expect((await User.findById(user._id)).cart.map(String)).toContain(cart._id.toString());

    // Stock is only decremented at order placement — a cart is not a hold.
    expect((await Product.findById(product._id)).variants[0].quantity).toBe(5);
  });

  test("rejects an unknown product", async () => {
    const user = await User.create({ name: "T", email: "gone@svc.com" });

    await expect(
      cartService.addToCart(
        addArgs(user, { _id: new mongoose.Types.ObjectId() })
      )
    ).rejects.toMatchObject({ isAppError: true, status: 404, message: "Product not found" });
  });

  test("rejects a blocked product", async () => {
    const { product } = await seedCatalog({ productBlocked: true });
    const user = await User.create({ name: "T", email: "blocked@svc.com" });

    await expect(cartService.addToCart(addArgs(user, product))).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/product is currently blocked/i),
    });
  });

  test("rejects an unlisted category", async () => {
    const { product } = await seedCatalog({ categoryListed: false });
    const user = await User.create({ name: "T", email: "cat@svc.com" });

    await expect(cartService.addToCart(addArgs(user, product))).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/category is currently not listed/i),
    });
  });

  test("rejects a blocked brand", async () => {
    const { product } = await seedCatalog({ brandBlocked: true });
    const user = await User.create({ name: "T", email: "brand@svc.com" });

    await expect(cartService.addToCart(addArgs(user, product))).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/brand is currently blocked/i),
    });
  });

  test("rejects more than the variant has in stock", async () => {
    const { product } = await seedCatalog({ stock: 2 });
    const user = await User.create({ name: "T", email: "stock@svc.com" });

    await expect(
      cartService.addToCart(addArgs(user, product, { quantity: 3 }))
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/out of stock or insufficient/i),
    });
  });

  test("rejects the same variant twice, and reports which one", async () => {
    const { product } = await seedCatalog();
    const user = await User.create({ name: "T", email: "dupe@svc.com" });

    await cartService.addToCart(addArgs(user, product));

    await expect(cartService.addToCart(addArgs(user, product))).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/already in your cart/i),
      // Nested because AppError.details is spread into the response body.
      details: { details: { size: "ONESIZE", color: "Black" } },
    });

    expect((await Cart.findOne({ userId: user._id })).items).toHaveLength(1);
  });

  test("a different variant of the same product is not a duplicate", async () => {
    const { product } = await seedCatalog();
    const user = await User.create({ name: "T", email: "variant@svc.com" });

    await cartService.addToCart(addArgs(user, product));
    await cartService.addToCart(addArgs(user, product, { color: "Red" }));

    expect((await Cart.findOne({ userId: user._id })).items).toHaveLength(2);
  });
});

describe("cartService.getCartPage", () => {
  test("a guest gets an empty cart, not an error", async () => {
    const page = await cartService.getCartPage(null);

    expect(page).toMatchObject({ isGuest: true, isCartEmpty: true, subtotal: 0, cartCount: 0 });
    expect(page.total).toBe(cartService.SHIPPING_CHARGE);
  });

  test("prices the lines and adds shipping", async () => {
    const { product } = await seedCatalog();
    const user = await User.create({ name: "T", email: "page@svc.com" });
    await cartService.addToCart(addArgs(user, product, { quantity: 2 }));

    const page = await cartService.getCartPage(user._id.toString());

    expect(page.cartItems).toHaveLength(1);
    expect(page.cartItems[0].itemTotal).toBe(800);
    expect(page.subtotal).toBe(800);
    expect(page.total).toBe(840);
    expect(page.isCartEmpty).toBe(false);
  });

  test("hides a line whose product has since been blocked, without deleting it", async () => {
    const { product } = await seedCatalog();
    const user = await User.create({ name: "T", email: "hide@svc.com" });
    await cartService.addToCart(addArgs(user, product));

    await Product.updateOne({ _id: product._id }, { isBlocked: true });

    const page = await cartService.getCartPage(user._id.toString());

    expect(page.cartItems).toHaveLength(0);
    expect(page.isCartEmpty).toBe(true);
    // Still on the cart document — only hidden from the view.
    expect((await Cart.findOne({ userId: user._id })).items).toHaveLength(1);
  });

  test("hides a line whose variant no longer exists on the product", async () => {
    const { product } = await seedCatalog();
    const user = await User.create({ name: "T", email: "novariant@svc.com" });
    await cartService.addToCart(addArgs(user, product));

    await Product.updateOne(
      { _id: product._id },
      { variants: [{ color: "Blue", size: "ONESIZE", quantity: 5 }] }
    );

    expect((await cartService.getCartPage(user._id.toString())).cartItems).toHaveLength(0);
  });
});

describe("cartService.updateCartQuantity", () => {
  test("reprices the line and the whole cart", async () => {
    const { product } = await seedCatalog();
    const user = await User.create({ name: "T", email: "upd@svc.com" });
    await cartService.addToCart(addArgs(user, product));

    const res = await cartService.updateCartQuantity({
      userId: user._id.toString(),
      productId: product._id.toString(),
      size: "ONESIZE",
      color: "Black",
      quantity: 3,
    });

    expect(res.itemTotal).toBe(1200);
    expect(res.cartSummary).toEqual({ subtotal: 1200, shippingCharge: 40, total: 1240 });
    expect((await Cart.findOne({ userId: user._id })).items[0].quantity).toBe(3);
  });

  test("rejects a line that isn't in the cart", async () => {
    const { product } = await seedCatalog();
    const user = await User.create({ name: "T", email: "missing@svc.com" });
    await cartService.addToCart(addArgs(user, product));

    await expect(
      cartService.updateCartQuantity({
        userId: user._id.toString(),
        productId: product._id.toString(),
        size: "ONESIZE",
        color: "Red",
        quantity: 2,
      })
    ).rejects.toMatchObject({ status: 404, message: "Item not found in cart" });
  });
});

describe("cartService.removeFromCart", () => {
  test("drops the line and unlinks an emptied cart from the user", async () => {
    const { product } = await seedCatalog();
    const user = await User.create({ name: "T", email: "rm@svc.com" });
    await cartService.addToCart(addArgs(user, product));

    await cartService.removeFromCart({
      userId: user._id.toString(),
      productId: product._id.toString(),
      size: "ONESIZE",
      color: "Black",
    });

    expect((await Cart.findOne({ userId: user._id })).items).toHaveLength(0);
    expect((await User.findById(user._id)).cart).toHaveLength(0);
  });

  test("keeps the cart linked while other lines remain", async () => {
    const { product } = await seedCatalog();
    const user = await User.create({ name: "T", email: "rm2@svc.com" });
    await cartService.addToCart(addArgs(user, product));
    await cartService.addToCart(addArgs(user, product, { color: "Red" }));

    await cartService.removeFromCart({
      userId: user._id.toString(),
      productId: product._id.toString(),
      size: "ONESIZE",
      color: "Black",
    });

    expect((await Cart.findOne({ userId: user._id })).items).toHaveLength(1);
    expect((await User.findById(user._id)).cart).toHaveLength(1);
  });

  test("rejects when there is no cart at all", async () => {
    const user = await User.create({ name: "T", email: "nocart@svc.com" });

    await expect(
      cartService.removeFromCart({
        userId: user._id.toString(),
        productId: new mongoose.Types.ObjectId().toString(),
        size: "ONESIZE",
        color: "Black",
      })
    ).rejects.toMatchObject({ status: 404, message: "Cart not found" });
  });
});

describe("cartService.getVariantStock", () => {
  test("returns the live quantity", async () => {
    const { product } = await seedCatalog({ stock: 7 });

    await expect(
      cartService.getVariantStock({
        productId: product._id.toString(),
        size: "ONESIZE",
        color: "Black",
      })
    ).resolves.toEqual({ stock: 7 });
  });

  test("404s on an unknown variant", async () => {
    const { product } = await seedCatalog();

    await expect(
      cartService.getVariantStock({
        productId: product._id.toString(),
        size: "XXL",
        color: "Black",
      })
    ).rejects.toMatchObject({ status: 404 });
  });
});
