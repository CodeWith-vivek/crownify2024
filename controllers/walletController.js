const User = require("../models/userSchema");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const Transaction=require("../models/transactionSchema")

const loadwalletpage = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId);
       const transactions = await Transaction.find({ userId }).sort({
         date: -1,
       }); 
    return res.render("wallet", { user: userData, transactions });
  } catch (error) {
    console.log("Error loading wallet page", error);
    res.status(500).send("Server error");
  }
};

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const addMoneyToWallet = async (req, res) => {
  try {
    const userId = req.session.user;
    const { amount } = req.body;

    console.log("Adding amount:", amount, "for user ID:", userId);

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
      amount: amount * 100, // Amount in paise
      currency: "INR",
      receipt: `receipt_${new Date().getTime()}`,
    };

    const order = await razorpay.orders.create(options);
    console.log("Razorpay order created:", order); // Debug log

    // Log the transaction for adding money to the wallet
    const transaction = new Transaction({
      userId,
      amount,
      type: "credit", // Since we are adding money to the wallet
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


const confirmPayment = async (req, res) => {
  try {
    const userId = req.session.user; 
    const { orderId, paymentId, signature, amount } = req.body;

    console.log("Confirming payment with data:", {
      orderId,
      paymentId,
      signature,
      amount,
    }); 

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

    console.log("Expected Signature:", expectedSignature); // Debug log

    if (signature !== expectedSignature) {
      console.error("Invalid payment signature"); // Debug log
      return res
        .status(400)
        .json({ success: false, message: "Invalid payment signature" });
    }

   
    user.wallet = (user.wallet || 0) + parseFloat(amount); 

    console.log("User wallet before update:", user.wallet - parseFloat(amount)); // Debug log
    console.log("User wallet after adding amount:", user.wallet); // Debug log

    await user.save();

    // Step 3: Respond with updated balance
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
