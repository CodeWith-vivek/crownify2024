const signupService = require("./signup.service");
const { sendError } = require("../../shared/errors/respond");

// HTTP adapters for registration. Rules live in signup.service.js; this
// file owns the session, which the service cannot touch — each step
// returns a `session` patch and it is applied here.

const applySession = (req, patch) => Object.assign(req.session, patch || {});

const loadSignup = async (req, res) => {
  try {
    const pending = req.session.userData || {};
    const counts = await signupService.getHeaderCounts(req.session.user);

    // Cleared on read: the form only needs to repopulate once, after a
    // failed attempt bounced the visitor back here.
    req.session.userData = null;

    return res.json({
      success: true,
      data: req.session.user ? { ...pending, ...counts } : pending,
    });
  } catch (error) {
    return sendError(res, error, "Signup page not loading");
  }
};

const loadOtpverify = async (req, res) => {
  try {
    const userData = req.session.userData;
    if (!userData) {
      return res.status(400).json({ success: false, redirect: "/signup" });
    }

    const counts = await signupService.getHeaderCounts(userData._id);
    req.session.countdownTime = signupService.OTP_COUNTDOWN_SECONDS;

    return res.json({
      success: true,
      userData,
      countdownTime: req.session.countdownTime,
      ...counts,
    });
  } catch (error) {
    return sendError(res, error, "Verify OTP page not loading");
  }
};

const signup = async (req, res) => {
  try {
    const { ok, message, redirect, session } = await signupService.startSignup({
      name: req.body.name,
      phone: req.body.phone,
      email: req.body.email,
      password: req.body.password,
      cPassword: req.body.cPassword,
      avatarPath: req.file ? "/uploads/avatars/" + req.file.filename : null,
    });

    applySession(req, session);

    return res.json({ success: ok, message, redirect });
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
    const { ok, message, redirectUrl, session } = await signupService.verifySignupOtp({
      otp: req.body.otp,
      sessionOtp: req.session.userOtp,
      sessionUserData: req.session.userData,
      attempts: req.session.otpAttempts || 0,
    });

    applySession(req, session);

    if (!ok) return res.json({ success: false, message });

    return res.json({ success: true, message, redirectUrl });
  } catch (error) {
    return sendError(res, error, "OTP verification error");
  }
};

const resendOtp = async (req, res) => {
  try {
    const { ok, message, session } = await signupService.resendSignupOtp({
      sessionUserData: req.session.userData,
    });

    applySession(req, session);

    if (!ok) return res.status(500).json({ success: false, message });

    return res.json({ success: true, message });
  } catch (error) {
    return sendError(res, error, "Resend OTP error");
  }
};

module.exports = { loadSignup, loadOtpverify, signup, verifyOtp, resendOtp };
