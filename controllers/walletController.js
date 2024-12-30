const User = require("../models/userSchema");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const Transaction=require("../models/transactionSchema")
const Category=require("../models/categorySchema")
const Brand=require("../models/brandSchema")




//cod eto load wallet page

const loadwalletpage = async (req, res) => {
  try {
    const userId = req.session.user;

    const [
      listedCategories,
      unblockedBrands,
      userData,
      totalTransactions,
      transactions,
    ] = await Promise.all([
      Category.find({ isListed: true }),
      Brand.find({ isBlocked: false }),
      User.findById(userId)
        .populate({
          path: "cart",
          populate: {
            path: "items.productId",
            model: "Product",
            populate: {
              path: "category",
              model: "Category",
            },
          },
        })
        .populate({
          path: "wishlist",
          populate: {
            path: "items.productId",
            model: "Product",
            populate: {
              path: "category",
              model: "Category",
            },
          },
        }),
      Transaction.countDocuments({ userId }),
      Transaction.find({ userId })
        .sort({ date: -1 })
        .skip(
          (parseInt(req.query.page) || 1 - 1) * (parseInt(req.query.limit) || 5)
        )
        .limit(parseInt(req.query.limit) || 5),
    ]);

    const listedCategoryIds = new Set(
      listedCategories.map((cat) => cat._id.toString())
    );
    const unblockedBrandNames = new Set(
      unblockedBrands.map((brand) => brand.brandName)
    );

    const isValidProduct = (product) => {
      return (
        product &&
        !product.isBlocked &&
        listedCategoryIds.has(product.category?._id?.toString()) &&
        unblockedBrandNames.has(product.brand)
      );
    };

    const cartCount = userData?.cart?.[0]?.items
      ? userData.cart[0].items.filter((item) => isValidProduct(item.productId))
          .length
      : 0;

    const wishlistCount = userData?.wishlist?.[0]?.items
      ? userData.wishlist[0].items.filter((item) =>
          isValidProduct(item.productId)
        ).length
      : 0;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const totalPages = Math.ceil(totalTransactions / limit);

    const renderData = {
      user: userData,
      transactions,
      currentPage: page,
      totalPages,
      cartCount,
      wishlistCount,
    };

    return res.render("wallet", renderData);
  } catch (error) {
    console.error("Error loading wallet page:", error);
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
        .json({ success: false, message: "User not found" });
    }

    const options = {
      amount: amount * 100,
      currency: "INR",
      receipt: `receipt_${new Date().getTime()}`,
    };

    const order = await razorpay.orders.create(options);

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

    const transaction = new Transaction({
      userId,
      amount,
      type: "credit",
      description: `Added money to wallet: `,
    });
    await transaction.save();

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
