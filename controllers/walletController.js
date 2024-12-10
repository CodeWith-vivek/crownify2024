const User = require("../models/userSchema");

const loadwalletpage = async (req, res) => {
  try {
    const userId = req.session.user;

    // Since the route is protected, we can assume user is defined
    const userData = await User.findById(userId);

    // Render the wallet page with user data
    return res.render("wallet", { user: userData });
  } catch (error) {
    console.log("Error loading wallet page", error);
    res.status(500).send("Server error");
  }
};

const addMoneyToWallet = async (req, res) => {
  try {
    const userId = req.session.user; // Logged-in user's ID
    const { amount } = req.body;

    console.log("Adding amount:", amount, "for user ID:", userId); // Debug log

    if (!amount || amount <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid amount" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Add the amount to the wallet
    user.wallet += parseFloat(amount);
    await user.save();

    console.log("New wallet balance:", user.wallet); // Debug log

    return res.status(200).json({
      success: true,
      message: `${amount} added to your wallet successfully.`,
      balance: user.wallet,
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

module.exports = {
  loadwalletpage,
  addMoneyToWallet,
  getWalletBalance,
};
