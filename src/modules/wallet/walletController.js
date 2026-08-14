const walletService = require("./wallet.service");
const { sendError } = require("../../shared/errors/respond");

// HTTP adapter only — rules live in wallet.service.js. Every route here is
// behind userAuth.

const loadwalletpage = async (req, res) => {
  try {
    const result = await walletService.getWalletPage({
      userId: req.session.user,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || walletService.TRANSACTIONS_PER_PAGE,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error loading wallet page");
  }
};

const addMoneyToWallet = async (req, res) => {
  try {
    const result = await walletService.createTopUpOrder({
      userId: req.session.user,
      amount: req.body.amount,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error adding money to wallet");
  }
};

const getWalletBalance = async (req, res) => {
  try {
    const result = await walletService.getBalance(req.session.user);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error fetching wallet balance");
  }
};

const confirmPayment = async (req, res) => {
  try {
    // req.body.amount is deliberately NOT forwarded: it was never covered
    // by the signature. The service reads the settled figure from Razorpay.
    const result = await walletService.confirmTopUp({
      userId: req.session.user,
      orderId: req.body.orderId,
      paymentId: req.body.paymentId,
      signature: req.body.signature,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error confirming payment");
  }
};

module.exports = {
  loadwalletpage,
  addMoneyToWallet,
  getWalletBalance,
  confirmPayment,
};
