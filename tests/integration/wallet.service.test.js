const crypto = require("crypto");
const mongoose = require("mongoose");
const { startTestDb } = require("../setup/testDb");

const RAZORPAY_SECRET = "wallet-test-secret";
process.env.RAZORPAY_KEY_SECRET = RAZORPAY_SECRET;
process.env.RAZORPAY_KEY_ID = "test-key";

// Razorpay's own record of the order is what the service credits from, so
// the stub has to be able to disagree with what the client claims.
const mockRazorpayOrders = new Map();

jest.mock("../../src/shared/config/razorpay", () => ({
  getRazorpay: () => ({
    orders: {
      create: jest.fn(async ({ amount }) => {
        const id = `order_${Math.random().toString(36).slice(2)}`;
        // Freshly created orders are unpaid until the stub is told otherwise.
        mockRazorpayOrders.set(id, { id, amount, amount_paid: 0, status: "created" });
        return { id, amount };
      }),
      fetch: jest.fn(async (id) => {
        const order = mockRazorpayOrders.get(id);
        if (!order) throw new Error("no such order");
        return order;
      }),
    },
  }),
}));

const walletService = require("../../src/modules/wallet/wallet.service");
const User = require("../../src/modules/user/userSchema");
const Transaction = require("../../src/modules/payment/transactionSchema");
require("../../src/modules/wishlist/wishlistSchema");
require("../../src/modules/cart/cartSchema");

let db;

beforeAll(async () => {
  db = await startTestDb();
});

afterEach(async () => {
  await db.clear();
  mockRazorpayOrders.clear();
});

afterAll(async () => {
  await db.stop();
});

const seedUser = (email, wallet = 0) => User.create({ name: "T", email, wallet });

const signatureFor = (orderId, paymentId) =>
  crypto.createHmac("sha256", RAZORPAY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");

/** Marks a stubbed Razorpay order as settled for the given rupee amount. */
function markPaid(orderId, rupees) {
  const order = mockRazorpayOrders.get(orderId);
  order.status = "paid";
  order.amount_paid = rupees * 100;
}

async function openTopUp(user, rupees) {
  const { orderId } = await walletService.createTopUpOrder({
    userId: user._id.toString(),
    amount: rupees,
  });
  return orderId;
}

describe("walletService.createTopUpOrder", () => {
  test("opens a Razorpay order in paise", async () => {
    const user = await seedUser("open@wal.com");

    const res = await walletService.createTopUpOrder({
      userId: user._id.toString(),
      amount: 500,
    });

    expect(res.orderId).toMatch(/^order_/);
    expect(mockRazorpayOrders.get(res.orderId).amount).toBe(50000);
    // Nothing credited until the payment is confirmed.
    expect((await User.findById(user._id)).wallet).toBe(0);
  });

  test("rejects a zero, negative or missing amount", async () => {
    const user = await seedUser("bad@wal.com");
    const userId = user._id.toString();

    for (const amount of [0, -100, undefined]) {
      await expect(walletService.createTopUpOrder({ userId, amount })).rejects.toMatchObject({
        isAppError: true,
        status: 400,
        message: "Invalid amount",
      });
    }
  });

  test("404s on an unknown user", async () => {
    await expect(
      walletService.createTopUpOrder({
        userId: new mongoose.Types.ObjectId().toString(),
        amount: 100,
      })
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("walletService.confirmTopUp", () => {
  test("credits the wallet and records the transaction", async () => {
    const user = await seedUser("ok@wal.com");
    const orderId = await openTopUp(user, 500);
    markPaid(orderId, 500);

    const res = await walletService.confirmTopUp({
      userId: user._id.toString(),
      orderId,
      paymentId: "pay_ok",
      signature: signatureFor(orderId, "pay_ok"),
    });

    expect(res.balance).toBe(500);
    expect((await User.findById(user._id)).wallet).toBe(500);

    const txn = await Transaction.findOne({ userId: user._id });
    expect(txn.type).toBe("credit");
    expect(txn.amount).toBe(500);
    expect(txn.paymentId).toBe("pay_ok");
  });

  test("credits what Razorpay settled, not what the caller claims", async () => {
    const user = await seedUser("inflate@wal.com");

    // Opens and pays for a 1 rupee top-up.
    const orderId = await openTopUp(user, 1);
    markPaid(orderId, 1);

    // The signature covers only orderId|paymentId, so it stays valid no
    // matter what amount rides alongside it. The old code trusted that
    // amount and would have credited 100000.
    await walletService.confirmTopUp({
      userId: user._id.toString(),
      orderId,
      paymentId: "pay_cheap",
      signature: signatureFor(orderId, "pay_cheap"),
      amount: 100000,
    });

    expect((await User.findById(user._id)).wallet).toBe(1);
  });

  test("the same payment cannot be credited twice", async () => {
    const user = await seedUser("replay@wal.com");
    const orderId = await openTopUp(user, 250);
    markPaid(orderId, 250);

    const args = {
      userId: user._id.toString(),
      orderId,
      paymentId: "pay_once",
      signature: signatureFor(orderId, "pay_once"),
    };

    await walletService.confirmTopUp(args);

    await expect(walletService.confirmTopUp(args)).rejects.toMatchObject({
      status: 400,
      message: "This payment has already been credited",
    });

    expect((await User.findById(user._id)).wallet).toBe(250);
    expect(await Transaction.countDocuments({ userId: user._id })).toBe(1);
  });

  test("a forged signature credits nothing", async () => {
    const user = await seedUser("forge@wal.com");
    const orderId = await openTopUp(user, 500);
    markPaid(orderId, 500);

    await expect(
      walletService.confirmTopUp({
        userId: user._id.toString(),
        orderId,
        paymentId: "pay_forged",
        signature: "nope",
      })
    ).rejects.toMatchObject({ status: 400, message: "Invalid payment signature" });

    expect((await User.findById(user._id)).wallet).toBe(0);
    expect(await Transaction.countDocuments({})).toBe(0);
  });

  test("an unpaid order credits nothing, even with a valid signature", async () => {
    const user = await seedUser("unpaid@wal.com");
    const orderId = await openTopUp(user, 500);

    await expect(
      walletService.confirmTopUp({
        userId: user._id.toString(),
        orderId,
        paymentId: "pay_pending",
        signature: signatureFor(orderId, "pay_pending"),
      })
    ).rejects.toMatchObject({ status: 400, message: "This payment has not been completed" });

    expect((await User.findById(user._id)).wallet).toBe(0);
  });

  test("missing fields are a 400", async () => {
    const user = await seedUser("missing@wal.com");

    await expect(
      walletService.confirmTopUp({ userId: user._id.toString(), orderId: "order_1" })
    ).rejects.toMatchObject({ status: 400, message: "Missing required payment details" });
  });

  test("adds onto an existing balance rather than replacing it", async () => {
    const user = await seedUser("add@wal.com", 1000);
    const orderId = await openTopUp(user, 500);
    markPaid(orderId, 500);

    const res = await walletService.confirmTopUp({
      userId: user._id.toString(),
      orderId,
      paymentId: "pay_add",
      signature: signatureFor(orderId, "pay_add"),
    });

    expect(res.balance).toBe(1500);
  });
});

describe("walletService reads", () => {
  test("balance comes back for the signed-in user", async () => {
    const user = await seedUser("bal@wal.com", 750);

    await expect(walletService.getBalance(user._id.toString())).resolves.toEqual({
      balance: 750,
    });

    await expect(
      walletService.getBalance(new mongoose.Types.ObjectId().toString())
    ).rejects.toMatchObject({ status: 404 });
  });

  test("the page paginates transactions newest first", async () => {
    const user = await seedUser("page@wal.com");

    for (let i = 0; i < 7; i++) {
      await Transaction.create({
        userId: user._id,
        amount: (i + 1) * 10,
        type: "credit",
        description: `txn ${i}`,
        date: new Date(Date.now() + i * 1000),
      });
    }

    const page1 = await walletService.getWalletPage({ userId: user._id.toString(), page: 1 });
    expect(page1.transactions).toHaveLength(5);
    expect(page1.totalPages).toBe(2);
    // Newest first: the last one seeded.
    expect(page1.transactions[0].amount).toBe(70);

    const page2 = await walletService.getWalletPage({ userId: user._id.toString(), page: 2 });
    expect(page2.transactions).toHaveLength(2);
  });

  test("another user's transactions are never listed", async () => {
    const owner = await seedUser("owner@wal.com");
    const other = await seedUser("other@wal.com");

    await Transaction.create({
      userId: owner._id,
      amount: 100,
      type: "credit",
      description: "owner only",
    });

    const page = await walletService.getWalletPage({ userId: other._id.toString() });
    expect(page.transactions).toHaveLength(0);
  });
});
