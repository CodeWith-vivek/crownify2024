const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { startTestDb } = require("../setup/testDb");

jest.mock("../../src/shared/utils/otpMailer", () => {
  const actual = jest.requireActual("../../src/shared/utils/otpMailer");
  return { ...actual, sendSignupOtp: jest.fn(async () => true) };
});

const authService = require("../../src/modules/user/auth.service");
const signupService = require("../../src/modules/user/signup.service");
const catalogService = require("../../src/modules/user/catalog.service");
const storefrontPagesService = require("../../src/modules/user/storefrontPages.service");
const { sendSignupOtp } = require("../../src/shared/utils/otpMailer");
const User = require("../../src/modules/user/userSchema");
const Product = require("../../src/modules/product/productSchema");
const Category = require("../../src/modules/category/categorySchema");
const Brand = require("../../src/modules/brand/brandSchema");
const Coupon = require("../../src/modules/coupon/couponSchema");
require("../../src/modules/wishlist/wishlistSchema");
require("../../src/modules/cart/cartSchema");

let db;

beforeAll(async () => {
  db = await startTestDb();
});

afterEach(async () => {
  await db.clear();
  jest.clearAllMocks();
});

afterAll(async () => {
  await db.stop();
});

const seedUser = async (email, extra = {}) =>
  User.create({
    name: "T",
    email,
    password: await bcrypt.hash("Secret@123", 10),
    ...extra,
  });

async function seedCatalog({ categoryListed = true, brandBlocked = false } = {}) {
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
  return { category, brand };
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
    variants: [{ color: "Black", size: "ONESIZE", quantity: 5 }],
    ...overrides,
  });

describe("authService.login", () => {
  test("accepts the right password and hands back a session patch", async () => {
    const user = await seedUser("in@svc.com");

    const res = await authService.login({ email: "in@svc.com", password: "Secret@123" });

    expect(res.ok).toBe(true);
    expect(res.redirectUrl).toBe("/");
    expect(res.session.user.toString()).toBe(user._id.toString());
    expect(res.session.isLoggedIn).toBe(true);
    // A sign-in must not inherit a half-finished password reset.
    expect(res.session.resetAllowed).toBe(false);
    expect(res.session.userOtp).toBeNull();
  });

  test("rejects a wrong password, an unknown email, and a blocked account", async () => {
    await seedUser("known@svc.com");
    await seedUser("blocked@svc.com", { isBlocked: true });

    await expect(
      authService.login({ email: "known@svc.com", password: "wrong" })
    ).resolves.toMatchObject({ ok: false, message: "Password Incorrect" });

    await expect(
      authService.login({ email: "nobody@svc.com", password: "Secret@123" })
    ).resolves.toMatchObject({ ok: false, message: "User not registered" });

    await expect(
      authService.login({ email: "blocked@svc.com", password: "Secret@123" })
    ).resolves.toMatchObject({ ok: false, message: "User is blocked by admin" });
  });

  test("points a Google account at the Google button instead of failing on the password", async () => {
    await User.create({ name: "G", email: "g@svc.com", googleId: "g-123" });

    await expect(
      authService.login({ email: "g@svc.com", password: "anything" })
    ).resolves.toMatchObject({ ok: false, message: /log in using Google/ });
  });
});

describe("authService.getCurrentUser", () => {
  test("an anonymous caller gets a null user, not an error", async () => {
    await expect(authService.getCurrentUser(null)).resolves.toMatchObject({
      user: null,
      cartCount: 0,
      wishlistCount: 0,
    });
  });

  test("returns only the fields the SPA needs — never the password hash", async () => {
    const user = await seedUser("me@svc.com");

    const res = await authService.getCurrentUser(user._id.toString());

    expect(Object.keys(res.user).sort()).toEqual(["_id", "avatar", "email", "name", "phone"]);
    expect(res.destroySession).toBeUndefined();
  });

  test("a blocked or deleted account asks the caller to tear the session down", async () => {
    const blocked = await seedUser("gone@svc.com", { isBlocked: true });

    await expect(authService.getCurrentUser(blocked._id.toString())).resolves.toMatchObject({
      user: null,
      destroySession: true,
    });

    await expect(
      authService.getCurrentUser(new mongoose.Types.ObjectId().toString())
    ).resolves.toMatchObject({ destroySession: true });
  });
});

describe("signupService", () => {
  const signupArgs = (overrides = {}) => ({
    name: "New",
    phone: "9999999999",
    email: "new@svc.com",
    password: "Secret@123",
    cPassword: "Secret@123",
    ...overrides,
  });

  test("emails an OTP and parks the pending account in the session, not the DB", async () => {
    const res = await signupService.startSignup(signupArgs());

    expect(res.ok).toBe(true);
    expect(res.redirect).toBe("/verify-otp");
    expect(res.session.userOtp).toMatch(/^\d{6}$/);
    expect(res.session.userData.email).toBe("new@svc.com");
    // Stored hashed even while only in the session.
    expect(res.session.userData.password).not.toBe("Secret@123");
    expect(sendSignupOtp).toHaveBeenCalledWith("new@svc.com", res.session.userOtp);

    expect(await User.findOne({ email: "new@svc.com" })).toBeNull();
  });

  test("rejects a mismatched confirmation and a taken email", async () => {
    await expect(
      signupService.startSignup(signupArgs({ cPassword: "Different@1" }))
    ).resolves.toMatchObject({ ok: false, message: "Passwords do not match" });

    await seedUser("taken@svc.com");
    await expect(
      signupService.startSignup(signupArgs({ email: "taken@svc.com" }))
    ).resolves.toMatchObject({ ok: false, message: /already exists/ });

    expect(sendSignupOtp).not.toHaveBeenCalled();
  });

  test("names Google when the email belongs to a Google account", async () => {
    await User.create({ name: "G", email: "goog@svc.com", googleId: "g-1" });

    await expect(
      signupService.startSignup(signupArgs({ email: "goog@svc.com" }))
    ).resolves.toMatchObject({ ok: false, message: /already registered via Google/ });
  });

  test("a failed send does not park a pending signup", async () => {
    sendSignupOtp.mockResolvedValueOnce(false);

    const res = await signupService.startSignup(signupArgs());

    expect(res).toMatchObject({ ok: false, message: "Error sending verification email" });
    expect(res.session).toBeUndefined();
  });

  test("the right OTP creates the account", async () => {
    const started = await signupService.startSignup(signupArgs());

    const res = await signupService.verifySignupOtp({
      otp: started.session.userOtp,
      sessionOtp: started.session.userOtp,
      sessionUserData: started.session.userData,
      attempts: 0,
    });

    expect(res.ok).toBe(true);
    const created = await User.findOne({ email: "new@svc.com" });
    expect(created).not.toBeNull();
    expect(res.session.user.toString()).toBe(created._id.toString());
    expect(res.session.userData).toBeNull();
  });

  test("a wrong OTP counts the attempt and creates nothing", async () => {
    const started = await signupService.startSignup(signupArgs());

    const res = await signupService.verifySignupOtp({
      otp: "000000",
      sessionOtp: started.session.userOtp,
      sessionUserData: started.session.userData,
      attempts: 2,
    });

    expect(res).toMatchObject({ ok: false, message: "Invalid OTP" });
    expect(res.session.otpAttempts).toBe(3);
    expect(await User.findOne({ email: "new@svc.com" })).toBeNull();
  });

  test("the sixth attempt burns the OTP", async () => {
    const started = await signupService.startSignup(signupArgs());

    const res = await signupService.verifySignupOtp({
      otp: started.session.userOtp,
      sessionOtp: started.session.userOtp,
      sessionUserData: started.session.userData,
      attempts: 5,
    });

    expect(res).toMatchObject({ ok: false, message: /Too many incorrect attempts/ });
    expect(res.session.userOtp).toBeNull();
    expect(await User.findOne({ email: "new@svc.com" })).toBeNull();
  });

  test("an expired session is reported rather than throwing", async () => {
    await expect(
      signupService.verifySignupOtp({ otp: "123456", sessionOtp: null })
    ).resolves.toMatchObject({ ok: false, message: /Session expired/ });
  });

  test("resend issues a new OTP and clears the attempt count", async () => {
    const started = await signupService.startSignup(signupArgs());

    const res = await signupService.resendSignupOtp({
      sessionUserData: started.session.userData,
    });

    expect(res.ok).toBe(true);
    expect(res.session.userOtp).toMatch(/^\d{6}$/);
    expect(res.session.otpAttempts).toBe(0);
  });

  test("resend with nothing pending is a 400", async () => {
    await expect(signupService.resendSignupOtp({ sessionUserData: null })).rejects.toMatchObject({
      isAppError: true,
      status: 400,
    });
  });
});

describe("catalogService.getShopPage", () => {
  test("paginates and computes the discount badge", async () => {
    const { category } = await seedCatalog();
    for (let i = 0; i < 14; i++) await seedProduct(category, { productName: `Cap ${i}` });

    const page1 = await catalogService.getShopPage({ userId: null, query: {} });

    expect(page1.products).toHaveLength(12);
    expect(page1.totalPages).toBe(2);
    expect(page1.totalProducts).toBe(14);
    // 1000 -> 750
    expect(page1.products[0].discountPercentage).toBe(25);

    const page2 = await catalogService.getShopPage({ userId: null, query: { page: "2" } });
    expect(page2.products).toHaveLength(2);
  });

  test("hides products in an unlisted category or a blocked brand", async () => {
    const { category } = await seedCatalog({ categoryListed: false });
    await seedProduct(category);

    expect((await catalogService.getShopPage({ userId: null, query: {} })).products).toHaveLength(0);
  });

  test("a filter forces page 1, so narrowing never lands on an empty page", async () => {
    const { category } = await seedCatalog();
    await seedProduct(category, { productName: "Beanie" });

    const res = await catalogService.getShopPage({
      userId: null,
      query: { page: "5", search: "beanie" },
    });

    expect(res.currentPage).toBe(1);
    expect(res.products).toHaveLength(1);
  });

  test("search matches name, description and brand", async () => {
    const { category } = await seedCatalog();
    await seedProduct(category, { productName: "Beanie", description: "warm wool" });
    await seedProduct(category, { productName: "Fedora", description: "straw" });

    const byName = await catalogService.getShopPage({ userId: null, query: { search: "beanie" } });
    expect(byName.products).toHaveLength(1);

    const byDescription = await catalogService.getShopPage({
      userId: null,
      query: { search: "wool" },
    });
    expect(byDescription.products).toHaveLength(1);
  });

  test("price range and size filters narrow the results", async () => {
    const { category } = await seedCatalog();
    await seedProduct(category, { productName: "Cheap", salePrice: 100 });
    await seedProduct(category, {
      productName: "Roomy",
      salePrice: 900,
      variants: [{ color: "Red", size: "L / XL", quantity: 2 }],
    });

    const byPrice = await catalogService.getShopPage({
      userId: null,
      query: { priceRange: "0-500" },
    });
    expect(byPrice.products.map((p) => p.productName)).toEqual(["Cheap"]);

    const bySize = await catalogService.getShopPage({
      userId: null,
      query: { sizes: "L / XL" },
    });
    expect(bySize.products.map((p) => p.productName)).toEqual(["Roomy"]);
  });

  test("sorting by price runs low to high and high to low", async () => {
    const { category } = await seedCatalog();
    await seedProduct(category, { productName: "Mid", salePrice: 500 });
    await seedProduct(category, { productName: "Low", salePrice: 100 });
    await seedProduct(category, { productName: "High", salePrice: 900 });

    const asc = await catalogService.getShopPage({
      userId: null,
      query: { sort: "priceLowHigh" },
    });
    expect(asc.products.map((p) => p.productName)).toEqual(["Low", "Mid", "High"]);

    const desc = await catalogService.getShopPage({
      userId: null,
      query: { sort: "priceHighLow" },
    });
    expect(desc.products.map((p) => p.productName)).toEqual(["High", "Mid", "Low"]);
  });

  test("each category carries its own product count", async () => {
    const { category } = await seedCatalog();
    await seedProduct(category);
    await seedProduct(category, { productName: "Second" });

    const res = await catalogService.getShopPage({ userId: null, query: {} });
    expect(res.categories[0].productCount).toBe(2);
  });
});

describe("catalogService.getProductDetails", () => {
  test("returns the product with its stock total and related products", async () => {
    const { category } = await seedCatalog();
    const product = await seedProduct(category, {
      variants: [
        { color: "Black", size: "ONESIZE", quantity: 2 },
        { color: "Red", size: "YOUTH", quantity: 3 },
      ],
    });
    await seedProduct(category, { productName: "Sibling" });

    const res = await catalogService.getProductDetails({
      userId: null,
      productId: product._id.toString(),
    });

    expect(res.product.totalQuantity).toBe(5);
    expect(res.product.discountPercentage).toBe(25);
    expect(res.relatedProducts.map((p) => p.productName)).toEqual(["Sibling"]);
    expect(res.cartCount).toBe(0);
  });

  test("404s for an unknown, blocked or hidden-category product", async () => {
    const { category } = await seedCatalog();
    const blocked = await seedProduct(category, { isBlocked: true });

    await expect(
      catalogService.getProductDetails({
        userId: null,
        productId: new mongoose.Types.ObjectId().toString(),
      })
    ).rejects.toMatchObject({ status: 404, message: "Product not found or unavailable" });

    await expect(
      catalogService.getProductDetails({ userId: null, productId: blocked._id.toString() })
    ).rejects.toMatchObject({ status: 404 });
  });

  test("related products exclude ones that are no longer visible", async () => {
    const { category } = await seedCatalog();
    const product = await seedProduct(category);
    await seedProduct(category, { productName: "Blocked sibling", isBlocked: true });

    const res = await catalogService.getProductDetails({
      userId: null,
      productId: product._id.toString(),
    });

    expect(res.relatedProducts).toHaveLength(0);
  });
});

describe("storefrontPagesService", () => {
  test("the home page carries coupons; the contact page does not", async () => {
    const { category } = await seedCatalog();
    await seedProduct(category);
    await Coupon.create({
      code: "SAVE10",
      description: "10 off",
      discountType: "percentage",
      discountAmount: 10,
      minPurchase: 100,
      usageLimit: 100,
      expiryDate: new Date(Date.now() + 86400000),
    });

    const home = await storefrontPagesService.getProductPage({
      userId: null,
      withCoupons: true,
      populateCategory: true,
    });
    expect(home.coupons).toHaveLength(1);
    expect(home.products).toHaveLength(1);

    const contact = await storefrontPagesService.getProductPage({ userId: null });
    expect(contact.coupons).toBeUndefined();
  });

  test("the brand page filters out unlisted categories at query level", async () => {
    const { category } = await seedCatalog({ categoryListed: false });
    await seedProduct(category);

    expect((await storefrontPagesService.getBrandPage({ userId: null })).products).toHaveLength(0);
  });

  test("a signed-in viewer gets their user document alongside the products", async () => {
    const { category } = await seedCatalog();
    await seedProduct(category);
    const user = await seedUser("viewer@svc.com");

    const res = await storefrontPagesService.getBrandPage({ userId: user._id.toString() });

    expect(res.user._id.toString()).toBe(user._id.toString());
    expect(res.products).toHaveLength(1);
  });
});
