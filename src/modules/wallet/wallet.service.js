const crypto = require("crypto");
const User = require("../user/userSchema");
const Transaction = require("../payment/transactionSchema");
const { getRazorpay } = require("../../shared/config/razorpay");
const { notFound, badRequest } = require("../../shared/errors/AppError");
const { loadStorefrontContext } = require("../../shared/utils/storefrontContext");

// Wallet rules, free of Express: the transaction history page, topping the
// wallet up through Razorpay, and the balance.

const TRANSACTIONS_PER_PAGE = 5;
const PAISE_PER_RUPEE = 100;

async function getWalletPage({ userId, page = 1, limit = TRANSACTIONS_PER_PAGE }) {
  const [context, totalTransactions, transactions] = await Promise.all([
    loadStorefrontContext(userId),
    Transaction.countDocuments({ userId }),
    Transaction.find({ userId })
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
  ]);

  return {
    user: context.userData,
    transactions,
    currentPage: page,
    totalPages: Math.ceil(totalTransactions / limit),
    cartCount: context.cartCount,
    wishlistCount: context.wishlistCount,
  };
}

async function getBalance(userId) {
  const user = await User.findById(userId);
  if (!user) throw notFound("User not found");

  return { balance: user.wallet };
}

/** Opens a Razorpay order for a top-up. Nothing is credited yet. */
async function createTopUpOrder({ userId, amount }) {
  if (!amount || amount <= 0) throw badRequest("Invalid amount");

  const user = await User.findById(userId);
  if (!user) throw notFound("User not found");

  const order = await getRazorpay().orders.create({
    amount: amount * PAISE_PER_RUPEE,
    currency: "INR",
    receipt: `receipt_${Date.now()}`,
  });

  return {
    message: "Order created successfully.",
    orderId: order.id,
    amount,
    key: process.env.RAZORPAY_KEY_ID,
  };
}

const isSignatureValid = ({ orderId, paymentId, signature }) =>
  crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex") === signature;

/**
 * Settles a top-up.
 *
 * The credited figure comes from Razorpay's own record of the order, NOT
 * from the request. The signature only covers `orderId|paymentId`, so the
 * `amount` field beside it was never authenticated — a customer could open
 * a ₹1 order, pay ₹1, then post the genuine signature alongside any amount
 * they liked and have the wallet credited with it.
 *
 * The paymentId is stored on the transaction so replaying the same
 * (orderId, paymentId, signature) triple cannot top the wallet up twice.
 */
async function confirmTopUp({ userId, orderId, paymentId, signature }) {
  if (!orderId || !paymentId || !signature) {
    throw badRequest("Missing required payment details");
  }

  const user = await User.findById(userId);
  if (!user) throw notFound("User not found");

  if (!isSignatureValid({ orderId, paymentId, signature })) {
    throw badRequest("Invalid payment signature");
  }

  if (await Transaction.findOne({ paymentId })) {
    throw badRequest("This payment has already been credited");
  }

  const razorpayOrder = await getRazorpay().orders.fetch(orderId);

  if (razorpayOrder.status !== "paid") {
    throw badRequest("This payment has not been completed");
  }

  const creditedAmount = razorpayOrder.amount_paid / PAISE_PER_RUPEE;

  user.wallet = (user.wallet || 0) + creditedAmount;
  await user.save();

  await new Transaction({
    userId,
    paymentId,
    amount: creditedAmount,
    type: "credit",
    description: "Added money to wallet",
  }).save();

  return {
    message: "Payment confirmed and wallet updated.",
    balance: user.wallet,
  };
}

module.exports = {
  getWalletPage,
  getBalance,
  createTopUpOrder,
  confirmTopUp,
  isSignatureValid,
  TRANSACTIONS_PER_PAGE,
};
