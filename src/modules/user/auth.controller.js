const bcrypt = require("bcrypt");
const User = require("./userSchema");
const { asString } = require("../../shared/utils/sanitize");

// Session lifecycle: who's signed in, signing in, signing out.
// Registration and OTP verification live in signup.controller.js.

// GET /api/auth/me — lets the SPA hydrate auth state on load/refresh.
const getCurrentUser = async (req, res) => {
  try {
    const userId = req.session.user;

    if (!userId) {
      return res.json({ success: true, user: null, cartCount: 0, wishlistCount: 0 });
    }

    const userData = await User.findById(userId)
      .populate({ path: "cart", populate: { path: "items.productId" } })
      .populate({ path: "wishlist", populate: { path: "items.productId" } });

    if (!userData || userData.isBlocked) {
      req.session.destroy(() => {});
      return res.json({ success: true, user: null, cartCount: 0, wishlistCount: 0 });
    }

    const cartCount = userData.cart?.[0]?.items?.length || 0;
    const wishlistCount = userData.wishlist?.[0]?.items?.length || 0;

    return res.json({
      success: true,
      user: {
        _id: userData._id,
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        avatar: userData.avatar,
      },
      cartCount,
      wishlistCount,
    });
  } catch (error) {
    console.error("Error fetching current user:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const loadLogin = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.json({ success: true, data: null });
    }

    const user = await User.findById(req.session.user)
      .populate("cart")
      .populate("wishlist");

    const cartCount = user.cart && user.cart.length > 0 ? user.cart[0].items.length : 0;
    const wishlistCount =
      user.wishlist && user.wishlist.length > 0 ? user.wishlist[0].items.length : 0;

    res.json({ success: true, data: null, alreadyLoggedIn: true, redirect: "/", cartCount, wishlistCount });
  } catch (error) {
    console.log("Error loading login page:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const login = async (req, res) => {
  try {
    const { email: rawEmail, password } = req.body;
    const email = asString(rawEmail);

    const existingUser = await User.findOne({ email }).select("+password");

    if (!existingUser) {
      return res.json({
        success: false,
        message: "User not registered",
      });
    }

    if (existingUser.isBlocked) {
      return res.json({
        success: false,
        message: "User is blocked by admin",
      });
    }

    // A Google-created account has no local password to compare against —
    // bcrypt.compare would just fail with a confusing "Password Incorrect".
    if (existingUser.googleId) {
      return res.json({
        success: false,
        message:
          "This email is associated with a Google account. Please log in using Google.",
      });
    }

    const passwordMatch = await bcrypt.compare(password, existingUser.password);

    if (!passwordMatch) {
      return res.json({
        success: false,
        message: "Password Incorrect",
      });
    }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    existingUser.status =
      existingUser.lastLogin >= sixMonthsAgo ? "Active" : "Inactive";
    await existingUser.save();

    req.session.user = existingUser._id;
    req.session.isLoggedIn = true;
    req.session.userOtp = null;
    req.session.email = null;
    req.session.countdownTime = null;

    return res.json({
      success: true,
      message: "Login Successful",
      redirectUrl: "/",
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.json({
      success: false,
      message: "An error occurred during login",
    });
  }
};

const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.log("session logout error", err);
        return res.status(500).json({ success: false, message: "Logout failed" });
      }
      return res.json({ success: true });
    });
  } catch (error) {
    console.log("logout error", error);
    res.status(500).json({ success: false, message: "Logout failed" });
  }
};

module.exports = { getCurrentUser, loadLogin, login, logout };
