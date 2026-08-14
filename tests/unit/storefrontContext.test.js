const mongoose = require("mongoose");
const { startTestDb } = require("../setup/testDb");
const { loadStorefrontContext } = require("../../src/shared/utils/storefrontContext");
const User = require("../../src/modules/user/userSchema");
const Category = require("../../src/modules/category/categorySchema");
const Brand = require("../../src/modules/brand/brandSchema");
const Product = require("../../src/modules/product/productSchema");
const Cart = require("../../src/modules/cart/cartSchema");
// Registers the Wishlist model — loadStorefrontContext populates "wishlist",
// and standalone tests don't get app.js's full require graph.
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

async function seedVisibleProduct() {
  const category = await Category.create({ name: "Caps", description: "Caps" });
  const brand = await Brand.create({ brandName: "Acme", brandImage: ["x.png"] });
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

describe("loadStorefrontContext", () => {
  test("guest (no userId): null user, zero counts, still loads catalog visibility", async () => {
    await seedVisibleProduct();

    const ctx = await loadStorefrontContext(undefined);

    expect(ctx.userData).toBeNull();
    expect(ctx.cartCount).toBe(0);
    expect(ctx.wishlistCount).toBe(0);
    expect(ctx.listedCategories).toHaveLength(1);
    expect(ctx.unblockedBrands).toHaveLength(1);
    expect(typeof ctx.isValidProduct).toBe("function");
  });

  test("signed-in user with a cart item: counts it, and the nested populate is deep enough for isValidProduct", async () => {
    const { product } = await seedVisibleProduct();
    const user = await User.create({ name: "Test", email: "ctx@test.com" });
    const cart = await Cart.create({
      userId: user._id,
      items: [
        {
          productId: product._id,
          productName: product.productName,
          variant: { color: "Black", size: "ONESIZE" },
          quantity: 1,
          productImage: "img.jpg",
          regularPrice: 500,
          salePrice: 400,
          totalPrice: 400,
        },
      ],
    });
    user.cart = [cart._id];
    await user.save();

    const ctx = await loadStorefrontContext(user._id.toString());

    // The count being 1 (not 0) is the real assertion here: it only passes
    // if items.productId AND its nested category both populated, since
    // isValidProduct reads product.category._id.
    expect(ctx.cartCount).toBe(1);
    expect(ctx.userData).not.toBeNull();
    expect(ctx.isValidProduct(ctx.userData.cart[0].items[0].productId)).toBe(true);
  });

  test("blocked brand hides the product from the count", async () => {
    const { product, brand } = await seedVisibleProduct();
    await Brand.findByIdAndUpdate(brand._id, { isBlocked: true });

    const user = await User.create({ name: "Test", email: "ctx2@test.com" });
    const cart = await Cart.create({
      userId: user._id,
      items: [
        {
          productId: product._id,
          productName: product.productName,
          variant: { color: "Black", size: "ONESIZE" },
          quantity: 1,
          productImage: "img.jpg",
          regularPrice: 500,
          salePrice: 400,
          totalPrice: 400,
        },
      ],
    });
    user.cart = [cart._id];
    await user.save();

    const ctx = await loadStorefrontContext(user._id.toString());

    expect(ctx.cartCount).toBe(0);
    expect(ctx.unblockedBrands).toHaveLength(0);
  });
});
