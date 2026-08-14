const mongoose = require("mongoose");
const { startTestDb } = require("../setup/testDb");
const wishlistService = require("../../src/modules/wishlist/wishlist.service");
const User = require("../../src/modules/user/userSchema");
const Wishlist = require("../../src/modules/wishlist/wishlistSchema");
const Product = require("../../src/modules/product/productSchema");
const Category = require("../../src/modules/category/categorySchema");
const Brand = require("../../src/modules/brand/brandSchema");
require("../../src/modules/cart/cartSchema");

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

async function seedCatalog({ categoryListed = true, brandBlocked = false } = {}) {
  const category = await Category.create({
    name: "Caps",
    description: "Caps",
    isListed: categoryListed,
  });
  await Brand.create({ brandName: "Acme", brandImage: ["b.png"], isBlocked: brandBlocked });
  return category;
}

const seedProduct = (category, overrides = {}) =>
  Product.create({
    productName: "Snapback",
    description: "A cap",
    brand: "Acme",
    category: category._id,
    regularPrice: 1000,
    salePrice: 750,
    productImage: ["i.jpg"],
    variants: [
      { color: "Black", size: "ONESIZE", quantity: 3 },
      { color: "Red", size: "ONESIZE", quantity: 2 },
      { color: "Black", size: "YOUTH", quantity: 4 },
    ],
    ...overrides,
  });

const seedUser = (email) => User.create({ name: "T", email });

describe("wishlistService.addToWishlist", () => {
  test("adds the product and links the wishlist to the user", async () => {
    const category = await seedCatalog();
    const product = await seedProduct(category);
    const user = await seedUser("add@wish.com");

    const res = await wishlistService.addToWishlist({
      userId: user._id.toString(),
      productId: product._id.toString(),
    });

    expect(res.message).toMatch(/added to wishlist/i);

    const wishlist = await Wishlist.findOne({ userId: user._id });
    expect(wishlist.items).toHaveLength(1);
    expect(wishlist.items[0].productDetails.productName).toBe("Snapback");
    expect((await User.findById(user._id)).wishlist.map(String)).toContain(
      wishlist._id.toString()
    );
  });

  test("rejects the same product twice", async () => {
    const category = await seedCatalog();
    const product = await seedProduct(category);
    const user = await seedUser("dupe@wish.com");
    const args = { userId: user._id.toString(), productId: product._id.toString() };

    await wishlistService.addToWishlist(args);

    await expect(wishlistService.addToWishlist(args)).rejects.toMatchObject({
      isAppError: true,
      status: 400,
      message: "Product is already in your wishlist.",
    });

    expect((await Wishlist.findOne({ userId: user._id })).items).toHaveLength(1);
  });

  test("404s on an unknown product or user", async () => {
    const category = await seedCatalog();
    const product = await seedProduct(category);
    const user = await seedUser("missing@wish.com");

    await expect(
      wishlistService.addToWishlist({
        userId: user._id.toString(),
        productId: new mongoose.Types.ObjectId().toString(),
      })
    ).rejects.toMatchObject({ status: 404, message: "Product not found." });

    await expect(
      wishlistService.addToWishlist({
        userId: new mongoose.Types.ObjectId().toString(),
        productId: product._id.toString(),
      })
    ).rejects.toMatchObject({ status: 404, message: "User not found." });
  });
});

describe("wishlistService.getWishlistPage", () => {
  test("a guest gets an empty wishlist, not an error", async () => {
    await expect(wishlistService.getWishlistPage(null)).resolves.toMatchObject({
      isGuest: true,
      isWishlistEmpty: true,
      wishlistItems: [],
    });
  });

  test("groups variants by size and names the category", async () => {
    const category = await seedCatalog();
    const product = await seedProduct(category);
    const user = await seedUser("page@wish.com");
    await wishlistService.addToWishlist({
      userId: user._id.toString(),
      productId: product._id.toString(),
    });

    const page = await wishlistService.getWishlistPage(user._id.toString());

    expect(page.wishlistItems).toHaveLength(1);
    const card = page.wishlistItems[0];

    expect(card.availableSizes.sort()).toEqual(["ONESIZE", "YOUTH"]);
    expect(card.variants.ONESIZE).toEqual({ colors: ["Black", "Red"], totalQuantity: 5 });
    expect(card.variants.YOUTH).toEqual({ colors: ["Black"], totalQuantity: 4 });
    // Read from the schema's `name`; a lookup of `categoryName` made every
    // card fall through to "Unknown".
    expect(card.category).toBe("Caps");
    expect(page.wishlistCount).toBe(1);
  });

  test("falls back to a placeholder when the product's images are gone", async () => {
    const category = await seedCatalog();
    const product = await seedProduct(category);
    const user = await seedUser("noimg@wish.com");
    await wishlistService.addToWishlist({
      userId: user._id.toString(),
      productId: product._id.toString(),
    });

    // The admin deleted every image after it was wishlisted.
    await Product.updateOne({ _id: product._id }, { productImage: [] });

    const page = await wishlistService.getWishlistPage(user._id.toString());
    expect(page.wishlistItems[0].productImage).toBe("/default-image.jpg");
  });

  test("hides a product that has since been blocked, without deleting it", async () => {
    const category = await seedCatalog();
    const product = await seedProduct(category);
    const user = await seedUser("hide@wish.com");
    await wishlistService.addToWishlist({
      userId: user._id.toString(),
      productId: product._id.toString(),
    });

    await Product.updateOne({ _id: product._id }, { isBlocked: true });

    const page = await wishlistService.getWishlistPage(user._id.toString());
    expect(page.wishlistItems).toHaveLength(0);
    expect(page.isWishlistEmpty).toBe(true);
    expect((await Wishlist.findOne({ userId: user._id })).items).toHaveLength(1);
  });

  test("hides a product whose brand has been blocked", async () => {
    const category = await seedCatalog();
    const product = await seedProduct(category);
    const user = await seedUser("brand@wish.com");
    await wishlistService.addToWishlist({
      userId: user._id.toString(),
      productId: product._id.toString(),
    });

    await Brand.updateOne({ brandName: "Acme" }, { isBlocked: true });

    expect((await wishlistService.getWishlistPage(user._id.toString())).wishlistItems).toHaveLength(0);
  });
});

describe("wishlistService.getColorsForSize", () => {
  test("returns the colours stocked in that size", async () => {
    const category = await seedCatalog();
    const product = await seedProduct(category);

    const { colors } = await wishlistService.getColorsForSize({
      productId: product._id.toString(),
      size: "ONESIZE",
    });

    expect(colors).toEqual([
      { color: "Black", quantity: 3 },
      { color: "Red", quantity: 2 },
    ]);
  });

  test("sums duplicate colour rows within a size", async () => {
    const category = await seedCatalog();
    const product = await seedProduct(category, {
      variants: [
        { color: "Black", size: "ONESIZE", quantity: 3 },
        { color: "Black", size: "ONESIZE", quantity: 4 },
      ],
    });

    const { colors } = await wishlistService.getColorsForSize({
      productId: product._id.toString(),
      size: "ONESIZE",
    });

    expect(colors).toEqual([{ color: "Black", quantity: 7 }]);
  });

  test("404s on an unknown product", async () => {
    await expect(
      wishlistService.getColorsForSize({
        productId: new mongoose.Types.ObjectId().toString(),
        size: "ONESIZE",
      })
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("wishlistService.removeFromWishlist", () => {
  test("drops the item and unlinks an emptied wishlist", async () => {
    const category = await seedCatalog();
    const product = await seedProduct(category);
    const user = await seedUser("rm@wish.com");
    const args = { userId: user._id.toString(), productId: product._id.toString() };

    await wishlistService.addToWishlist(args);
    await wishlistService.removeFromWishlist(args);

    expect((await Wishlist.findOne({ userId: user._id })).items).toHaveLength(0);
    expect((await User.findById(user._id)).wishlist).toHaveLength(0);
  });

  test("keeps the link while other items remain", async () => {
    const category = await seedCatalog();
    const first = await seedProduct(category);
    const second = await seedProduct(category, { productName: "Other" });
    const user = await seedUser("rm2@wish.com");
    const userId = user._id.toString();

    await wishlistService.addToWishlist({ userId, productId: first._id.toString() });
    await wishlistService.addToWishlist({ userId, productId: second._id.toString() });
    await wishlistService.removeFromWishlist({ userId, productId: first._id.toString() });

    expect((await Wishlist.findOne({ userId: user._id })).items).toHaveLength(1);
    expect((await User.findById(user._id)).wishlist).toHaveLength(1);
  });

  test("404s with no wishlist, and with a product that isn't on it", async () => {
    const category = await seedCatalog();
    const product = await seedProduct(category);
    const user = await seedUser("none@wish.com");
    const userId = user._id.toString();

    await expect(
      wishlistService.removeFromWishlist({ userId, productId: product._id.toString() })
    ).rejects.toMatchObject({ status: 404, message: "Wishlist not found." });

    await wishlistService.addToWishlist({ userId, productId: product._id.toString() });

    await expect(
      wishlistService.removeFromWishlist({
        userId,
        productId: new mongoose.Types.ObjectId().toString(),
      })
    ).rejects.toMatchObject({ status: 404, message: "Product not found in wishlist." });
  });
});
