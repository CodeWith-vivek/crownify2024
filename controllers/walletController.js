const User = require("../models/userSchema");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const Transaction=require("../models/transactionSchema")



const loadwalletpage = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId);

    const page = parseInt(req.query.page) || 1; // Default to page 1
    const limit = parseInt(req.query.limit) || 5; // Default limit of 5 per page
    const skip = (page - 1) * limit;

    const totalTransactions = await Transaction.countDocuments({ userId });
    const totalPages = Math.ceil(totalTransactions / limit);

    const transactions = await Transaction.find({ userId })
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit);

    return res.render("wallet", {
      user: userData,
      transactions,
      currentPage: page,
      totalPages,
    });
  } catch (error) {
    console.log("Error loading wallet page", error);
    res.status(500).send("Server error");
  }
};

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

//code to add money in wallet

const addMoneyToWallet = async (req, res) => {
  try {
    const userId = req.session.user;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid amount" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User  not found" });
    }

    const options = {
      amount: amount * 100, 
      currency: "INR",
      receipt: `receipt_${new Date().getTime()}`,
    };

    const order = await razorpay.orders.create(options);
  
    const transaction = new Transaction({
      userId,
      amount,
      type: "credit", 
      description: `Added money to wallet: `,
    });
    await transaction.save();

    return res.status(200).json({
      success: true,
      message: "Order created successfully.",
      orderId: order.id,
      amount: amount,
    });
  } catch (error) {
    console.error("Error adding money to wallet:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

//cod eto wallet balance

const getWalletBalance = async (req, res) => {
  try {
    const userId = req.session.user;

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      balance: user.wallet,
    });
  } catch (error) {
    console.error("Error fetching wallet balance:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

//cod e for confirm payment

const confirmPayment = async (req, res) => {
  try {
    const userId = req.session.user; 
    const { orderId, paymentId, signature, amount } = req.body;

    if (!orderId || !paymentId || !signature || !amount) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required payment details" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

   
    const body = orderId + "|" + paymentId; 
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (signature !== expectedSignature) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid payment signature" });
    }

   
    user.wallet = (user.wallet || 0) + parseFloat(amount); 
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Payment confirmed and wallet updated.",
      balance: user.wallet,
    });
  } catch (error) {
    console.error("Error confirming payment:", error);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

module.exports = {
  loadwalletpage,
  addMoneyToWallet,
  getWalletBalance,
  confirmPayment,
};
