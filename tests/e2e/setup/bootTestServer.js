// Boots a throwaway Express + in-memory MongoDB instance for Playwright to
// drive a real browser against, seeded with one known product/user/address
// so the specs have something deterministic to click through. Spawned as
// its own process by playwright.config.js's webServer — never touches the
// real .env or the real Atlas database (MONGODB_URI below is set BEFORE
// src/app.js is required, and dotenv never overrides an already-set var).
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { MongoMemoryServer } = require("mongodb-memory-server");

const PORT = process.env.PORT || "3100";
const SEED = require("./fixtures");

async function boot() {
  const mongod = await MongoMemoryServer.create();

  process.env.MONGODB_URI = mongod.getUri();
  process.env.PORT = PORT;
  process.env.NODE_ENV = "test";
  process.env.SESSION_SECRET = "e2e-test-secret";
  // Never actually called (Google login isn't exercised by these specs) —
  // passport's GoogleStrategy just needs non-empty strings to construct.
  process.env.GOOGLE_CLIENT_ID = "e2e-test-google-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "e2e-test-google-client-secret";
  // Razorpay is lazy-initialized (src/shared/config/razorpay.js) and never
  // actually called by the COD path these specs exercise.
  process.env.RAZORPAY_KEY_ID = "e2e-test-razorpay-key";
  process.env.RAZORPAY_KEY_SECRET = "e2e-test-razorpay-secret";

  await mongoose.connect(process.env.MONGODB_URI);

  const Category = require("../../../src/modules/category/categorySchema");
  const Brand = require("../../../src/modules/brand/brandSchema");
  const Product = require("../../../src/modules/product/productSchema");
  const User = require("../../../src/modules/user/userSchema");
  const Address = require("../../../src/modules/address/addressSchema");

  const category = await Category.create({
    name: "E2E CAPS",
    description: "Seeded for end-to-end tests.",
    isListed: true,
  });

  await Brand.create({
    brandName: "E2E Brand",
    brandImage: ["https://placehold.co/200x200.png"],
    isBlocked: false,
  });

  await Product.create({
    productName: SEED.productName,
    description: "Seeded product for end-to-end tests.",
    brand: "E2E Brand",
    category: category._id,
    regularPrice: 999,
    salePrice: 799,
    productImage: ["https://placehold.co/400x400.png"],
    status: "Available",
    variants: [{ color: SEED.color, size: SEED.size, quantity: 25 }],
  });

  const user = await User.create({
    name: "E2E Shopper",
    email: SEED.userEmail,
    password: await bcrypt.hash(SEED.userPassword, 10),
  });

  const address = await Address.create({
    userId: user._id,
    addressType: "Home",
    fullName: "E2E Shopper",
    country: "India",
    mobileNumber: "9999999999",
    postalCode: "600001",
    flatHouseCompany: "1",
    areaStreet: "Test Street",
    city: "Chennai",
    state: "TN",
    isPrimary: true,
  });
  user.addresses = [address._id];
  await user.save();

  const app = require("../../../src/app");
  app.listen(PORT, () => {
    console.log(`e2e test server listening on ${PORT}`);
  });
}

boot().catch((error) => {
  console.error("e2e test server failed to boot:", error);
  process.exit(1);
});
