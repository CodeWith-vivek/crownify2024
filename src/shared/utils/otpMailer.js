const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");

/**
 * Signup and password reset both email a six-digit OTP, and both had their
 * own copy of the transporter, the generator, the hash helper and a ~20-line
 * HTML template that differed only in its heading and intro line. One copy
 * lives here; the wording each flow needs is passed in.
 */

const OTP_LENGTH_FLOOR = 100000;
const OTP_RANGE = 900000;
const BCRYPT_ROUNDS = 10;

function generateOtp() {
  return Math.floor(OTP_LENGTH_FLOOR + Math.random() * OTP_RANGE).toString();
}

function securePassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

function buildOtpEmailHtml({ heading, intro, otp }) {
  return `
    <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px; background-color: #f4f4f4;">
      <div style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);">
        <h2 style="color: #333333;">${heading}</h2>
        <p style="font-size: 16px; color: #555555;">${intro}</p>
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
  `;
}

// Built per send rather than once at module scope, so requiring this file
// never depends on the mail credentials being present — the same reason
// the Razorpay client is created lazily.
function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.NODEMAILER_EMAIL,
      pass: process.env.NODEMAILER_PASSWORD,
    },
  });
}

/**
 * @returns {Promise<boolean>} whether the message was accepted for
 *   delivery. Callers branch on this rather than getting an exception,
 *   because a bounced OTP is a normal "try again", not a bug.
 */
async function sendOtpEmail(email, otp, { subject, heading, intro }) {
  try {
    const info = await createTransporter().sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject,
      text: `Your OTP is ${otp}`,
      html: buildOtpEmailHtml({ heading, intro, otp }),
    });
    return info.accepted.length > 0;
  } catch (error) {
    console.log("Error sending OTP email:", error);
    return false;
  }
}

const sendSignupOtp = (email, otp) =>
  sendOtpEmail(email, otp, {
    subject: "Verify your account",
    heading: "Verify Your Account",
    intro: "Thank you for registering with us! Please use the OTP below to verify your account:",
  });

const sendPasswordResetOtp = (email, otp) =>
  sendOtpEmail(email, otp, {
    subject: "Your OTP for password reset",
    heading: "Your OTP for password reset",
    intro: "Please use the OTP below to reset your password:",
  });

module.exports = {
  generateOtp,
  securePassword,
  sendOtpEmail,
  sendSignupOtp,
  sendPasswordResetOtp,
};
