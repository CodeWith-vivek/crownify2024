const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { startTestDb } = require("../setup/testDb");

// Mail is the only outside-world dependency in this module.
jest.mock("../../src/shared/utils/otpMailer", () => {
  const actual = jest.requireActual("../../src/shared/utils/otpMailer");
  return { ...actual, sendPasswordResetOtp: jest.fn(async () => true) };
});

const profileService = require("../../src/modules/profile/profile.service");
const addressService = require("../../src/modules/profile/address.service");
const passwordResetService = require("../../src/modules/profile/passwordReset.service");
const { sendPasswordResetOtp } = require("../../src/shared/utils/otpMailer");
const User = require("../../src/modules/user/userSchema");
const Address = require("../../src/modules/address/addressSchema");
const Order = require("../../src/modules/order/orderSchema");
const Product = require("../../src/modules/product/productSchema");
const Category = require("../../src/modules/category/categorySchema");
const Brand = require("../../src/modules/brand/brandSchema");
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

const addressBody = (overrides = {}) => ({
  addressType: "Home",
  name: "T Shopper",
  country: "India",
  phone: "9999999999",
  pincode: "600001",
  home: "1A",
  area: "Main Street",
  landmark: "Near park",
  town: "Chennai",
  state: "TN",
  ...overrides,
});

const seedUser = async (email, password = "Secret@123") =>
  User.create({ name: "T", email, password: await bcrypt.hash(password, 10) });

describe("profileService.updateProfileDetails", () => {
  test("updates name and phone without touching the password", async () => {
    const user = await seedUser("edit@svc.com");

    await profileService.updateProfileDetails({
      userId: user._id.toString(),
      name: "New Name",
      phone: "8888888888",
    });

    const saved = await User.findById(user._id).select("+password");
    expect(saved.name).toBe("New Name");
    expect(saved.phone).toBe("8888888888");
    expect(await bcrypt.compare("Secret@123", saved.password)).toBe(true);
  });

  test("changes the password when the current one is proved", async () => {
    const user = await seedUser("pw@svc.com");

    await profileService.updateProfileDetails({
      userId: user._id.toString(),
      password: "Secret@123",
      newPassword: "Fresh@456",
    });

    const saved = await User.findById(user._id).select("+password");
    expect(await bcrypt.compare("Fresh@456", saved.password)).toBe(true);
  });

  test("rejects a wrong current password and changes nothing", async () => {
    const user = await seedUser("wrong@svc.com");

    await expect(
      profileService.updateProfileDetails({
        userId: user._id.toString(),
        name: "Should Not Stick",
        password: "NotMyPassword",
        newPassword: "Fresh@456",
      })
    ).rejects.toMatchObject({ isAppError: true, status: 400, message: "Incorrect current password" });

    const saved = await User.findById(user._id).select("+password");
    expect(saved.name).toBe("T");
    expect(await bcrypt.compare("Secret@123", saved.password)).toBe(true);
  });

  test("404s on an unknown user", async () => {
    await expect(
      profileService.updateProfileDetails({
        userId: new mongoose.Types.ObjectId().toString(),
        name: "X",
      })
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("profileService.isCurrentPasswordValid", () => {
  test("answers true only for the real password", async () => {
    const user = await seedUser("check@svc.com");
    const userId = user._id.toString();

    await expect(
      profileService.isCurrentPasswordValid({ userId, password: "Secret@123" })
    ).resolves.toBe(true);

    await expect(
      profileService.isCurrentPasswordValid({ userId, password: "nope" })
    ).resolves.toBe(false);
  });
});

describe("profileService.getOrderHistory", () => {
  async function seedOrderFor(user, { orderStatus = "Delivered" } = {}) {
    const category = await Category.create({ name: `Caps${Math.random()}`, description: "d" });
    await Brand.create({ brandName: "Acme", brandImage: ["b.png"] }).catch(() => {});
    const product = await Product.create({
      productName: `Cap${Math.random()}`,
      description: "d",
      brand: "Acme",
      category: category._id,
      regularPrice: 500,
      salePrice: 400,
      productImage: ["i.jpg"],
      variants: [{ color: "Black", size: "ONESIZE", quantity: 5 }],
    });

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

    return Order.create({
      userId: user._id,
      // orderNumber is uniquely indexed and only generated by placeOrder,
      // so hand-built fixtures have to supply their own.
      orderNumber: `TEST-${new mongoose.Types.ObjectId()}`,
      shippingAddress: address._id,
      items: [
        {
          productId: product._id,
          productName: product.productName,
          productImage: "i.jpg",
          variant: { color: "Black", size: "ONESIZE" },
          quantity: 1,
          salePrice: 400,
          regularPrice: 500,
          totalPrice: 400,
          orderStatus,
        },
      ],
      subtotal: 400,
      shipping: 40,
      total: 440,
      grandTotal: 440,
      paymentMethod: "COD",
    });
  }

  test("paginates and tags each item with a badge class", async () => {
    const user = await seedUser("orders@svc.com");
    for (let i = 0; i < 3; i++) await seedOrderFor(user);

    const page1 = await profileService.getOrderHistory({
      userId: user._id.toString(),
      page: 1,
      limit: 2,
    });

    expect(page1.orders).toHaveLength(2);
    expect(page1.totalPages).toBe(2);
    expect(page1.orders[0].items[0].badgeClass).toBe("text-success");
    expect(page1.orders[0].financials).toBeDefined();

    const page2 = await profileService.getOrderHistory({
      userId: user._id.toString(),
      page: 2,
      limit: 2,
    });
    expect(page2.orders).toHaveLength(1);
  });

  test("an unrecognised status falls back to the neutral badge", async () => {
    const user = await seedUser("badge@svc.com");
    await seedOrderFor(user, { orderStatus: "Failed" });

    const { orders } = await profileService.getOrderHistory({ userId: user._id.toString() });
    expect(orders[0].items[0].badgeClass).toBe("bg-secondary");
  });

  test("drops orders whose only product has been blocked", async () => {
    const user = await seedUser("hidden@svc.com");
    const order = await seedOrderFor(user);
    await Product.updateOne({ _id: order.items[0].productId }, { isBlocked: true });

    const { orders } = await profileService.getOrderHistory({ userId: user._id.toString() });
    expect(orders).toHaveLength(0);
  });
});

describe("addressService.addAddress", () => {
  test("the first address is primary automatically", async () => {
    const user = await seedUser("first@addr.com");

    const address = await addressService.addAddress({
      userId: user._id.toString(),
      body: addressBody(),
    });

    expect(address.isPrimary).toBe(true);
    expect(address.fullName).toBe("T Shopper");
    expect(address.city).toBe("Chennai");
    expect((await User.findById(user._id)).addresses.map(String)).toContain(
      address._id.toString()
    );
  });

  test("a later address is not primary unless asked for", async () => {
    const user = await seedUser("second@addr.com");
    const userId = user._id.toString();

    await addressService.addAddress({ userId, body: addressBody() });
    const second = await addressService.addAddress({ userId, body: addressBody() });

    expect(second.isPrimary).toBe(false);
  });

  test("asking for primary demotes the previous one", async () => {
    const user = await seedUser("promote@addr.com");
    const userId = user._id.toString();

    const first = await addressService.addAddress({ userId, body: addressBody() });
    const second = await addressService.addAddress({
      userId,
      body: addressBody({ isPrimary: "true" }),
    });

    expect((await Address.findById(first._id)).isPrimary).toBe(false);
    expect((await Address.findById(second._id)).isPrimary).toBe(true);
  });

  test("rejects a missing required field", async () => {
    const user = await seedUser("blank@addr.com");

    await expect(
      addressService.addAddress({
        userId: user._id.toString(),
        body: addressBody({ town: "" }),
      })
    ).rejects.toMatchObject({ status: 400, message: "All fields are required." });
  });

  test("caps the address book at four", async () => {
    const user = await seedUser("full@addr.com");
    const userId = user._id.toString();

    for (let i = 0; i < 4; i++) await addressService.addAddress({ userId, body: addressBody() });

    await expect(
      addressService.addAddress({ userId, body: addressBody() })
    ).rejects.toMatchObject({ status: 400, message: /cannot add more than 4 addresses/ });
  });
});

describe("addressService — ownership is enforced", () => {
  test("another user cannot make someone else's address primary", async () => {
    const owner = await seedUser("owner@addr.com");
    const attacker = await seedUser("attacker@addr.com");
    const address = await addressService.addAddress({
      userId: owner._id.toString(),
      body: addressBody(),
    });

    await expect(
      addressService.setPrimaryAddress({
        userId: attacker._id.toString(),
        addressId: address._id.toString(),
      })
    ).rejects.toMatchObject({ status: 404, message: "Address not found" });
  });

  test("another user cannot edit or delete someone else's address", async () => {
    const owner = await seedUser("owner2@addr.com");
    const attacker = await seedUser("attacker2@addr.com");
    const address = await addressService.addAddress({
      userId: owner._id.toString(),
      body: addressBody(),
    });

    await expect(
      addressService.updateAddress({
        userId: attacker._id.toString(),
        addressId: address._id.toString(),
        body: addressBody({ name: "Hijacked" }),
      })
    ).rejects.toMatchObject({ status: 404 });

    await expect(
      addressService.deleteAddress({
        userId: attacker._id.toString(),
        addressId: address._id.toString(),
      })
    ).rejects.toMatchObject({ status: 404 });

    expect((await Address.findById(address._id)).fullName).toBe("T Shopper");
  });
});

describe("addressService.deleteAddress", () => {
  test("promotes a survivor when the primary is deleted", async () => {
    const user = await seedUser("promote2@addr.com");
    const userId = user._id.toString();

    const primary = await addressService.addAddress({ userId, body: addressBody() });
    const other = await addressService.addAddress({ userId, body: addressBody() });

    await addressService.deleteAddress({ userId, addressId: primary._id.toString() });

    expect((await Address.findById(other._id)).isPrimary).toBe(true);
  });

  test("unlinks the address from the user document", async () => {
    const user = await seedUser("unlink@addr.com");
    const userId = user._id.toString();
    const address = await addressService.addAddress({ userId, body: addressBody() });

    await addressService.deleteAddress({ userId, addressId: address._id.toString() });

    expect((await User.findById(userId)).addresses).toHaveLength(0);
  });
});

describe("addressService.updateAddress", () => {
  test("saves the translated field names", async () => {
    const user = await seedUser("upd@addr.com");
    const userId = user._id.toString();
    const address = await addressService.addAddress({ userId, body: addressBody() });

    const { address: updated } = await addressService.updateAddress({
      userId,
      addressId: address._id.toString(),
      body: addressBody({ name: "Renamed", town: "Bengaluru" }),
    });

    expect(updated.fullName).toBe("Renamed");
    expect(updated.city).toBe("Bengaluru");
  });

  test("a schema validation failure becomes a readable 400", async () => {
    const user = await seedUser("bad@addr.com");
    const userId = user._id.toString();
    const address = await addressService.addAddress({ userId, body: addressBody() });

    await expect(
      addressService.updateAddress({
        userId,
        addressId: address._id.toString(),
        body: addressBody({ addressType: "Spaceship" }),
      })
    ).rejects.toMatchObject({ isAppError: true, status: 400 });
  });
});

describe("passwordResetService", () => {
  test("an unknown email is reported, and no OTP is sent", async () => {
    const res = await passwordResetService.requestResetOtp({ email: "nobody@svc.com" });

    expect(res).toMatchObject({ sent: false, message: "Email not found." });
    expect(sendPasswordResetOtp).not.toHaveBeenCalled();
  });

  test("a known email gets an OTP, and the session patch carries it", async () => {
    await seedUser("reset@svc.com");

    const res = await passwordResetService.requestResetOtp({ email: "reset@svc.com" });

    expect(res.sent).toBe(true);
    expect(res.redirect).toBe("/otp-page");
    expect(res.session.email).toBe("reset@svc.com");
    expect(res.session.userOtp).toMatch(/^\d{6}$/);
    // A fresh request must not inherit authorisation from an earlier one.
    expect(res.session.resetAllowed).toBe(false);
    expect(sendPasswordResetOtp).toHaveBeenCalledWith("reset@svc.com", res.session.userOtp);
  });

  test("a failed send is reported rather than pretending success", async () => {
    await seedUser("bounce@svc.com");
    sendPasswordResetOtp.mockResolvedValueOnce(false);

    await expect(
      passwordResetService.requestResetOtp({ email: "bounce@svc.com" })
    ).resolves.toMatchObject({ sent: false, message: /Failed to send OTP/ });
  });

  test("the right OTP authorises the reset; a wrong one does not", () => {
    expect(passwordResetService.verifyResetOtp({ otp: "123456", sessionOtp: "123456" })).toMatchObject(
      { redirectUrl: "/reset-password", session: { userOtp: null, resetAllowed: true } }
    );

    expect(() =>
      passwordResetService.verifyResetOtp({ otp: "000000", sessionOtp: "123456" })
    ).toThrow("Invalid OTP. Please try again.");

    expect(() =>
      passwordResetService.verifyResetOtp({ otp: "123456", sessionOtp: null })
    ).toThrow(/No OTP found in session/);
  });

  test("completing a reset rewrites the password and revokes authorisation", async () => {
    await seedUser("done@svc.com");

    const res = await passwordResetService.completePasswordReset({
      email: "done@svc.com",
      password: "Brand@New1",
      cPassword: "Brand@New1",
    });

    expect(res.redirect).toBe("/login");
    // Left set, a finished reset would authorise the next one for a
    // different address without any OTP.
    expect(res.session.resetAllowed).toBe(false);
    expect(res.session.email).toBeNull();

    const saved = await User.findOne({ email: "done@svc.com" }).select("+password");
    expect(await bcrypt.compare("Brand@New1", saved.password)).toBe(true);
  });

  test("mismatched confirmation leaves the password alone", async () => {
    await seedUser("mismatch@svc.com");

    await expect(
      passwordResetService.completePasswordReset({
        email: "mismatch@svc.com",
        password: "Brand@New1",
        cPassword: "Different@1",
      })
    ).rejects.toMatchObject({ status: 400, message: "Passwords do not match." });

    const saved = await User.findOne({ email: "mismatch@svc.com" }).select("+password");
    expect(await bcrypt.compare("Secret@123", saved.password)).toBe(true);
  });

  test("no email in session is a 400, not a silent no-op", async () => {
    await expect(
      passwordResetService.completePasswordReset({
        email: null,
        password: "a",
        cPassword: "a",
      })
    ).rejects.toMatchObject({ status: 400, message: "No email found in session." });
  });
});
