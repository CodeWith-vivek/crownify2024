const User = require("../user/userSchema");
const { asString } = require("../../shared/utils/sanitize");
const {
  generateOtp,
  securePassword,
  sendPasswordResetOtp,
} = require("../../shared/utils/otpMailer");
const { AppError, badRequest } = require("../../shared/errors/AppError");

// Password reset: request by email -> OTP emailed -> OTP verified -> new
// password set. Distinct from the signup OTP flow in user/signup.service.js
// (that one creates an account; this one only unlocks a reset for an
// account that already exists).
//
// The flow's state lives in the session, which the service must not touch.
// So each step takes the session values it needs as arguments and returns
// a `session` patch describing what the controller should write back.

const DEFAULT_COUNTDOWN_SECONDS = 120;

/**
 * The pages in this flow are reachable while signed out, so they only need
 * the shallow cart/wishlist lengths for the header badges — not the
 * visibility-filtered counts, which need a user to filter for.
 */
async function getHeaderCounts(userId) {
  if (!userId) return { cartCount: 0, wishlistCount: 0 };

  const user = await User.findById(userId).populate("cart").populate("wishlist");
  if (!user) return { cartCount: 0, wishlistCount: 0 };

  return {
    cartCount: user.cart?.length > 0 ? user.cart[0].items.length : 0,
    wishlistCount: user.wishlist?.length > 0 ? user.wishlist[0].items.length : 0,
  };
}

/**
 * Step 1. A missing account and a failed send are both reported as
 * `{ sent: false, message }` rather than thrown — the client renders the
 * message inline on the form.
 */
async function requestResetOtp({ email: rawEmail }) {
  const email = asString(rawEmail);
  const user = await User.findOne({ email });

  if (!user) return { sent: false, message: "Email not found." };

  const otp = generateOtp();
  const emailSent = await sendPasswordResetOtp(email, otp);

  if (!emailSent) {
    return { sent: false, message: "Failed to send OTP. Please try again." };
  }

  return {
    sent: true,
    message: "OTP sent successfully.",
    redirect: "/otp-page",
    session: { userOtp: otp, email, resetAllowed: false },
  };
}

/**
 * Step 2. On success the caller is told to set `resetAllowed`, which is
 * what the allowResetPassword route guard checks before letting step 4
 * run.
 */
function verifyResetOtp({ otp, sessionOtp }) {
  if (!sessionOtp) {
    throw badRequest("No OTP found in session. Please request a new one.");
  }

  if (otp !== sessionOtp) {
    throw badRequest("Invalid OTP. Please try again.");
  }

  return {
    message: "OTP verified successfully.",
    redirectUrl: "/reset-password",
    session: { userOtp: null, resetAllowed: true },
  };
}

/** Step 3 (optional). */
async function resendResetOtp({ email }) {
  if (!email) throw badRequest("Email is required .");

  const otp = generateOtp();
  const emailSent = await sendPasswordResetOtp(email, otp);

  if (!emailSent) {
    throw new AppError("Failed to resend OTP. Please try again.", { status: 500 });
  }

  return { message: "OTP resent successfully.", session: { userOtp: otp } };
}

/** Step 4. */
async function completePasswordReset({ email, password, cPassword }) {
  if (!email) throw badRequest("No email found in session.");
  if (password !== cPassword) throw badRequest("Passwords do not match.");

  await User.updateOne({ email }, { $set: { password: await securePassword(password) } });

  return {
    message: "Your password has been reset successfully.",
    redirect: "/login",
    // resetAllowed is cleared alongside the rest. Leaving it set let a
    // finished reset authorise the next one: the same session could then
    // start a reset for a different address and skip the OTP entirely,
    // because the route guard only checks that the flag is truthy.
    session: {
      userOtp: null,
      email: null,
      countdownTime: null,
      previousEmail: null,
      resetAllowed: false,
    },
  };
}

module.exports = {
  getHeaderCounts,
  requestResetOtp,
  verifyResetOtp,
  resendResetOtp,
  completePasswordReset,
  DEFAULT_COUNTDOWN_SECONDS,
};
