const User = require("./userSchema");
const { asString } = require("../../shared/utils/sanitize");
const { generateOtp, securePassword, sendSignupOtp } = require("../../shared/utils/otpMailer");
const { badRequest } = require("../../shared/errors/AppError");
const { countsFor } = require("./auth.service");

// Registration, free of Express. The User document is deliberately NOT
// written until the OTP is confirmed; until then the pending signup lives
// in the session, so an abandoned signup leaves no half-created account
// behind. The session itself is the controller's to write — each step
// returns a `session` patch.

const OTP_COUNTDOWN_SECONDS = 120;
const MAX_OTP_ATTEMPTS = 5;

async function getHeaderCounts(userId) {
  if (!userId) return { cartCount: 0, wishlistCount: 0 };
  const user = await User.findById(userId).populate("cart").populate("wishlist");
  return countsFor(user);
}

/**
 * Step 1. Rejections resolve with `ok: false` rather than throwing — the
 * signup form renders the message inline and stays put.
 */
async function startSignup({ name, phone, email: rawEmail, password, cPassword, avatarPath }) {
  const email = asString(rawEmail);

  if (password !== cPassword) {
    return { ok: false, message: "Passwords do not match", redirect: "/signup" };
  }

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    return {
      ok: false,
      message: existingUser.googleId
        ? "User with this email already registered via Google."
        : "User with this email already exists.",
      redirect: "/signup",
    };
  }

  const otp = generateOtp();

  if (!(await sendSignupOtp(email, otp))) {
    return { ok: false, message: "Error sending verification email", redirect: "/signup" };
  }

  return {
    ok: true,
    message: "OTP sent successfully! Please verify.",
    redirect: "/verify-otp",
    session: {
      userOtp: otp,
      otpAttempts: 0,
      // Held in the session, not written to the DB — see the note at the
      // top of this file.
      userData: {
        name,
        phone,
        email,
        password: await securePassword(password),
        avatar: avatarPath || null,
      },
    },
  };
}

/**
 * Step 2. Creates the account only once the OTP matches.
 *
 * @param {{otp, sessionOtp, sessionUserData, attempts}} args  all session
 *   state arrives as plain values; the returned `session` patch says what
 *   to write back.
 */
async function verifySignupOtp({ otp, sessionOtp, sessionUserData, attempts = 0 }) {
  if (!sessionOtp) {
    return { ok: false, message: "Session expired. Please request a new OTP." };
  }

  const nextAttempts = attempts + 1;

  if (nextAttempts > MAX_OTP_ATTEMPTS) {
    return {
      ok: false,
      message: "Too many incorrect attempts. Please request a new OTP.",
      session: { userOtp: null, otpAttempts: 0 },
    };
  }

  if (otp.toString() !== sessionOtp.toString()) {
    return { ok: false, message: "Invalid OTP", session: { otpAttempts: nextAttempts } };
  }

  if (!sessionUserData) {
    throw badRequest("User data is missing. Please try again.");
  }

  const newUser = await new User({
    name: sessionUserData.name,
    email: sessionUserData.email,
    phone: sessionUserData.phone,
    password: sessionUserData.password,
    avatar: sessionUserData.avatar || null,
    wishlist: [],
  }).save();

  return {
    ok: true,
    message: "Signup successful!",
    redirectUrl: "/",
    session: { user: newUser._id, userOtp: null, userData: null, otpAttempts: 0 },
  };
}

/** Step 3 (optional). */
async function resendSignupOtp({ sessionUserData }) {
  if (!sessionUserData) throw badRequest("User data not found.");

  const otp = generateOtp();

  if (!(await sendSignupOtp(sessionUserData.email, otp))) {
    return { ok: false, message: "Error sending email." };
  }

  return {
    ok: true,
    message: "New OTP sent to your email.",
    session: { userOtp: otp, otpAttempts: 0 },
  };
}

module.exports = {
  getHeaderCounts,
  startSignup,
  verifySignupOtp,
  resendSignupOtp,
  OTP_COUNTDOWN_SECONDS,
  MAX_OTP_ATTEMPTS,
};
