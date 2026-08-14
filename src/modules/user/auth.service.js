const bcrypt = require("bcrypt");
const User = require("./userSchema");
const { asString } = require("../../shared/utils/sanitize");

// Session lifecycle rules, free of Express. Registration and OTP live in
// signup.service.js.
//
// A rejected login resolves with `ok: false` rather than throwing. It is
// not an AppError because the controller must answer 200: apiClient turns
// any 401 into an `auth:unauthorized` broadcast that bounces the viewer to
// the login screen, which on the login screen itself is a loop.

const INACTIVITY_MONTHS = 6;

/** Shallow header badge counts — cart/wishlist lengths, unfiltered. */
function countsFor(user) {
  return {
    cartCount: user?.cart?.[0]?.items?.length || 0,
    wishlistCount: user?.wishlist?.[0]?.items?.length || 0,
  };
}

const ANONYMOUS = { user: null, cartCount: 0, wishlistCount: 0 };

/**
 * Backs GET /api/auth/me, which the SPA calls on load and refresh to
 * hydrate auth state.
 *
 * @returns {Promise<{user, cartCount, wishlistCount, destroySession?: boolean}>}
 *   `destroySession` tells the controller to tear down a session pointing
 *   at an account that has since been deleted or blocked.
 */
async function getCurrentUser(userId) {
  if (!userId) return ANONYMOUS;

  const userData = await User.findById(userId)
    .populate({ path: "cart", populate: { path: "items.productId" } })
    .populate({ path: "wishlist", populate: { path: "items.productId" } });

  if (!userData || userData.isBlocked) {
    return { ...ANONYMOUS, destroySession: true };
  }

  return {
    user: {
      _id: userData._id,
      name: userData.name,
      email: userData.email,
      phone: userData.phone,
      avatar: userData.avatar,
    },
    ...countsFor(userData),
  };
}

/** Backs the login page, which only needs to know whether to bounce. */
async function getLoginPageData(userId) {
  if (!userId) return { data: null };

  const user = await User.findById(userId).populate("cart").populate("wishlist");

  return {
    data: null,
    alreadyLoggedIn: true,
    redirect: "/",
    ...countsFor(user),
  };
}

async function login({ email: rawEmail, password }) {
  const email = asString(rawEmail);
  const user = await User.findOne({ email }).select("+password");

  if (!user) return { ok: false, message: "User not registered" };
  if (user.isBlocked) return { ok: false, message: "User is blocked by admin" };

  // A Google-created account has no local password to compare against —
  // bcrypt.compare would just fail with a confusing "Password Incorrect".
  if (user.googleId) {
    return {
      ok: false,
      message: "This email is associated with a Google account. Please log in using Google.",
    };
  }

  if (!(await bcrypt.compare(password, user.password))) {
    return { ok: false, message: "Password Incorrect" };
  }

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - INACTIVITY_MONTHS);
  user.status = user.lastLogin >= cutoff ? "Active" : "Inactive";
  await user.save();

  return {
    ok: true,
    message: "Login Successful",
    redirectUrl: "/",
    // Any half-finished password-reset state is dropped on a successful
    // sign-in, so a stale OTP can't be replayed against the new session.
    session: {
      user: user._id,
      isLoggedIn: true,
      userOtp: null,
      email: null,
      countdownTime: null,
      resetAllowed: false,
    },
  };
}

module.exports = { getCurrentUser, getLoginPageData, login, countsFor };
