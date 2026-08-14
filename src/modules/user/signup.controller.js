const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const User = require("./userSchema");
const { asString } = require("../../shared/utils/sanitize");

// Registration flow: signup form -> OTP emailed -> OTP verified -> account
// actually created. The User document is deliberately NOT written until the
// OTP is confirmed; until then the pending signup lives in the session, so
// an abandoned signup leaves no half-created account behind.

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

async function sendVerificationEmail(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Verify your account",
      text: `your otp is${otp}`,
      html: `
    <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px; background-color: #f4f4f4;">
      <div style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);">
        <h2 style="color: #333333;">Verify Your Account</h2>
        <p style="font-size: 16px; color: #555555;">
          Thank you for registering with us! Please use the OTP below to verify your account:
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
    });
    return info.accepted.length > 0;
  } catch (error) {
    console.log("Error sending email ", error);
    return false;
  }
}

const loadSignup = async (req, res) => {
  try {
    const userId = req.session.user;
    let userData = req.session.userData || {};

    if (userId) {
      const user = await User.findById(userId).populate("cart").populate("wishlist");

      const cartCount = user.cart && user.cart.length > 0 ? user.cart[0].items.length : 0;
      const wishlistCount =
        user.wishlist && user.wishlist.length > 0 ? user.wishlist[0].items.length : 0;

      userData = { ...userData, cartCount, wishlistCount };
    }

    req.session.userData = null;

    res.json({ success: true, data: userData });
  } catch (error) {
    console.log("Signup page not loading", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const loadOtpverify = async (req, res) => {
  try {
    const userData = req.session.userData;
    if (!userData) {
      return res.status(400).json({ success: false, redirect: "/signup" });
    }

    const userId = userData._id;
    let cartCount = 0;
    let wishlistCount = 0;

    if (userId) {
      const user = await User.findById(userId).populate("cart").populate("wishlist");
      cartCount = user.cart && user.cart.length > 0 ? user.cart[0].items.length : 0;
      wishlistCount =
        user.wishlist && user.wishlist.length > 0 ? user.wishlist[0].items.length : 0;
    }

    req.session.countdownTime = 120;

    res.json({
      success: true,
      userData,
      countdownTime: req.session.countdownTime,
      cartCount,
      wishlistCount,
    });
  } catch (error) {
    console.log("Verify OTP page not loading", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const signup = async (req, res) => {
  try {
    const { name, phone, email: rawEmail, password, cPassword } = req.body;
    const email = asString(rawEmail);

    if (password !== cPassword) {
      return res.json({
        success: false,
        message: "Passwords do not match",
        redirect: "/signup",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      if (existingUser.googleId) {
        return res.json({
          success: false,
          message: "User with this email already registered via Google.",
          redirect: "/signup",
        });
      }

      return res.json({
        success: false,
        message: "User with this email already exists.",
        redirect: "/signup",
      });
    }

    const otp = generateOtp();

    const emailSent = await sendVerificationEmail(email, otp);

    if (emailSent) {
      const hashedPassword = await securePassword(password);
      let avatarPath = req.file ? "/uploads/avatars/" + req.file.filename : null;

      req.session.userOtp = otp;

      // Held in the session, not written to the DB — see the note at the
      // top of this file about not creating accounts before verification.
      req.session.userData = {
        name,
        phone,
        email,
        password: hashedPassword,
        avatar: avatarPath,
      };

      return res.json({
        success: true,
        message: "OTP sent successfully! Please verify.",
        redirect: "/verify-otp",
      });
    } else {
      return res.json({
        success: false,
        message: "Error sending verification email",
        redirect: "/signup",
      });
    }
  } catch (error) {
    console.log("signup error", error);
    return res.json({
      success: false,
      message: "An unexpected error occurred. Please try again later.",
      redirect: "/pageNotFound",
    });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    const sessionOtp = req.session.userOtp;

    if (!sessionOtp) {
      return res.json({
        success: false,
        message: "Session expired. Please request a new OTP.",
      });
    }

    req.session.otpAttempts = (req.session.otpAttempts || 0) + 1;
    if (req.session.otpAttempts > 5) {
      req.session.userOtp = null;
      req.session.otpAttempts = 0;
      return res.json({
        success: false,
        message: "Too many incorrect attempts. Please request a new OTP.",
      });
    }

    if (otp.toString() === sessionOtp.toString()) {
      req.session.otpAttempts = 0;
      const user = req.session.userData;

      if (!user) {
        return res.status(400).json({
          success: false,
          message: "User data is missing. Please try again.",
        });
      }

      const avatarPath = user.avatar || null;

      const newUser = new User({
        name: user.name,
        email: user.email,
        phone: user.phone,
        password: user.password,
        avatar: avatarPath,
        wishlist: [],
      });

      await newUser.save().catch((saveError) => {
        return res.status(400).json({
          success: false,
          message: "Error saving user. Please try again.",
        });
      });

      req.session.user = newUser._id;
      req.session.userOtp = null;
      req.session.userData = null;

      return res.json({
        success: true,
        redirectUrl: "/",
        message: "Signup successful!",
      });
    } else {
      return res.json({ success: false, message: "Invalid OTP" });
    }
  } catch (error) {
    console.log("OTP verification error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const resendOtp = async (req, res) => {
  try {
    const userData = req.session.userData;
    if (!userData) {
      return res
        .status(400)
        .json({ success: false, message: "User data not found." });
    }

    const newOtp = generateOtp();
    const emailSent = await sendVerificationEmail(userData.email, newOtp);

    if (emailSent) {
      req.session.userOtp = newOtp;
      return res.json({
        success: true,
        message: "New OTP sent to your email.",
      });
    } else {
      return res
        .status(500)
        .json({ success: false, message: "Error sending email." });
    }
  } catch (error) {
    console.log("Resend OTP error", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = {
  loadSignup,
  loadOtpverify,
  signup,
  verifyOtp,
  resendOtp,
  securePassword,
  generateOtp,
  sendVerificationEmail,
};
