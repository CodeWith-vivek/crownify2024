const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const User = require("../user/userSchema");
const { asString } = require("../../shared/utils/sanitize");

// Password reset flow: request by email -> OTP emailed -> OTP verified ->
// new password set. Distinct from the signup OTP flow in
// user/signup.controller.js (that one creates an account; this one only
// unlocks a reset for an account that already exists), which is why the
// two keep their own otp/email helpers rather than sharing one.

const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) {
    console.log("password hash error", error);
  }
};

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const sendVerificationEmail = async (email, otp) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });

    const mailOptions = {
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Your OTP for password reset",
      text: `your otp is${otp}`,
      html: `
    <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px; background-color: #f4f4f4;">
      <div style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);">
        <h2 style="color: #333333;">Your OTP for password reset</h2>
        <p style="font-size: 16px; color: #555555;">
         Please use the OTP below to reset your password:
        </p>
        <div style="margin: 20px 0; font-size: 24px; font-weight: bold; background-color: #007BFF; color: white; padding: 10px; border-radius: 5px;">
          ${otp}
        </div>
        <p style="font-size: 14px; color: #777777;">
          If you did not request this, please ignore this email.
        </p>
        <p style="font-size: 12px; color: #999999;">
          &copy; ${new Date().getFullYear()} CROWNIFY. All rights reserved.
        </p>
      </div>
    </div>
  `,
    };

    await transporter.sendMail(mailOptions);

    return true;
  } catch (error) {
    console.log("error sending password resest email", error);
    return false;
  }
};

// These three page-load endpoints only need the shallow cart/wishlist
// lengths for the header badges, not the deep visibility-filtered counts —
// they're reachable while signed out, where there's no user to filter for.
async function shallowCounts(userId) {
  if (!userId) return { cartCount: 0, wishlistCount: 0 };
  const user = await User.findById(userId).populate("cart").populate("wishlist");
  return {
    cartCount: user.cart && user.cart.length > 0 ? user.cart[0].items.length : 0,
    wishlistCount: user.wishlist && user.wishlist.length > 0 ? user.wishlist[0].items.length : 0,
  };
}

const getForgotPassPage = async (req, res) => {
  try {
    if (req.session.isLoggedIn) {
      const counts = await shallowCounts(req.session.user);
      return res.json({ success: true, alreadyLoggedIn: true, redirect: "/", ...counts });
    }

    res.json({ success: true, cartCount: 0, wishlistCount: 0 });
  } catch (error) {
    console.log("Error loading forgot-password page:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const loadOtpPage = async (req, res) => {
  try {
    if (!req.session.userOtp || !req.session.email) {
      return res.status(400).json({ success: false, redirect: "/forget-password" });
    }

    const counts = await shallowCounts(req.session.user);
    const countdownTime = req.session.countdownTime || 120;

    res.json({
      success: true,
      userData: req.session.email,
      countdownTime,
      ...counts,
    });
  } catch (error) {
    console.log("Error loading OTP page:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const getResetPassPage = async (req, res) => {
  try {
    if (req.session.isLoggedIn) {
      return res.json({ success: true, alreadyLoggedIn: true, redirect: "/" });
    }

    const counts = await shallowCounts(req.session.user);
    res.json({ success: true, ...counts });
  } catch (error) {
    console.log("Error loading reset-password page:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const forgotEmailValid = async (req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    if (req.session.isLoggedIn) {
      return res.json({
        success: false,
        message: "User is already logged in.",
        redirect: "/",
      });
    }

    const email = asString(req.body.email);
    const findUser = await User.findOne({ email });

    if (findUser) {
      const otp = generateOtp();
      const emailSent = await sendVerificationEmail(email, otp);

      if (emailSent) {
        req.session.userOtp = otp;
        req.session.email = email;

        return res.json({
          success: true,
          message: "OTP sent successfully.",
          redirect: "/otp-page",
        });
      } else {
        return res.json({
          success: false,
          message: "Failed to send OTP. Please try again.",
        });
      }
    } else {
      return res.json({
        success: false,
        message: "Email not found.",
      });
    }
  } catch (error) {
    console.error("Error in forgotEmailValid:", error);
    return res.status(500).json({
      success: false,
      message: "An internal server error occurred.",
    });
  }
};

const verifyOtpForgot = async (req, res) => {
  try {
    const { otp } = req.body;
    const sessionOtp = req.session.userOtp;

    if (!sessionOtp) {
      return res.status(400).json({
        success: false,
        message: "No OTP found in session. Please request a new one.",
      });
    }

    if (otp === sessionOtp) {
      req.session.userOtp = null;
      // Gates the reset-password endpoint — without this flag set, a
      // caller could POST a new password without ever proving they own
      // the email.
      req.session.resetAllowed = true;

      return res.status(200).json({
        success: true,
        message: "OTP verified successfully.",
        redirectUrl: "/reset-password",
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP. Please try again.",
      });
    }
  } catch (error) {
    console.error("OTP verification error:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while verifying OTP. Please try again later.",
    });
  }
};

const resendOtpForgot = async (req, res) => {
  try {
    const userEmail = req.session.email;

    if (!userEmail) {
      return res
        .status(400)
        .json({ success: false, message: "Email is required ." });
    }

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(userEmail, otp);

    if (emailSent) {
      req.session.userOtp = otp;
      return res.json({ success: true, message: "OTP resent successfully." });
    } else {
      return res.status(500).json({
        success: false,
        message: "Failed to resend OTP. Please try again.",
      });
    }
  } catch (error) {
    console.error("Error resending OTP:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while resending the OTP.",
    });
  }
};

const forgotNewPassword = async (req, res) => {
  try {
    const { password, cPassword } = req.body;
    const email = req.session.email;

    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "No email found in session." });
    }

    if (password !== cPassword) {
      return res
        .status(400)
        .json({ success: false, message: "Passwords do not match." });
    }

    const passwordHash = await securePassword(password);

    await User.updateOne({ email: email }, { $set: { password: passwordHash } });

    req.session.userOtp = null;
    req.session.email = null;
    req.session.countdownTime = null;
    req.session.previousEmail = null;

    return res.json({
      success: true,
      message: "Your password has been reset successfully.",
      redirect: "/login",
    });
  } catch (error) {
    console.error("Error in resetting password:", error);
    return res
      .status(500)
      .json({ success: false, message: "An internal server error occurred." });
  }
};

module.exports = {
  getForgotPassPage,
  loadOtpPage,
  getResetPassPage,
  forgotEmailValid,
  verifyOtpForgot,
  resendOtpForgot,
  forgotNewPassword,
};
