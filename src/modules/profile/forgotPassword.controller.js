const passwordResetService = require("./passwordReset.service");
const { sendError } = require("../../shared/errors/respond");

// HTTP adapters for the password-reset flow. Rules live in
// passwordReset.service.js; this file owns the session, which the service
// deliberately cannot touch — each step returns a `session` patch and it is
// applied here.

const applySession = (req, patch) => Object.assign(req.session, patch || {});

const getForgotPassPage = async (req, res) => {
  try {
    if (req.session.isLoggedIn) {
      const counts = await passwordResetService.getHeaderCounts(req.session.user);
      return res.json({ success: true, alreadyLoggedIn: true, redirect: "/", ...counts });
    }

    return res.json({ success: true, cartCount: 0, wishlistCount: 0 });
  } catch (error) {
    return sendError(res, error, "Error loading forgot-password page");
  }
};

const loadOtpPage = async (req, res) => {
  try {
    if (!req.session.userOtp || !req.session.email) {
      return res.status(400).json({ success: false, redirect: "/forget-password" });
    }

    const counts = await passwordResetService.getHeaderCounts(req.session.user);

    return res.json({
      success: true,
      userData: req.session.email,
      countdownTime:
        req.session.countdownTime || passwordResetService.DEFAULT_COUNTDOWN_SECONDS,
      ...counts,
    });
  } catch (error) {
    return sendError(res, error, "Error loading OTP page");
  }
};

const getResetPassPage = async (req, res) => {
  try {
    if (req.session.isLoggedIn) {
      return res.json({ success: true, alreadyLoggedIn: true, redirect: "/" });
    }

    const counts = await passwordResetService.getHeaderCounts(req.session.user);
    return res.json({ success: true, ...counts });
  } catch (error) {
    return sendError(res, error, "Error loading reset-password page");
  }
};

const forgotEmailValid = async (req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    if (req.session.isLoggedIn) {
      return res.json({ success: false, message: "User is already logged in.", redirect: "/" });
    }

    const { sent, message, redirect, session } = await passwordResetService.requestResetOtp({
      email: req.body.email,
    });

    applySession(req, session);

    return res.json({ success: sent, message, ...(redirect ? { redirect } : {}) });
  } catch (error) {
    return sendError(res, error, "Error in forgotEmailValid");
  }
};

const verifyOtpForgot = async (req, res) => {
  try {
    const { message, redirectUrl, session } = passwordResetService.verifyResetOtp({
      otp: req.body.otp,
      sessionOtp: req.session.userOtp,
    });

    applySession(req, session);

    return res.status(200).json({ success: true, message, redirectUrl });
  } catch (error) {
    return sendError(res, error, "OTP verification error");
  }
};

const resendOtpForgot = async (req, res) => {
  try {
    const { message, session } = await passwordResetService.resendResetOtp({
      email: req.session.email,
    });

    applySession(req, session);

    return res.json({ success: true, message });
  } catch (error) {
    return sendError(res, error, "Error resending OTP");
  }
};

const forgotNewPassword = async (req, res) => {
  try {
    const { message, redirect, session } = await passwordResetService.completePasswordReset({
      email: req.session.email,
      password: req.body.password,
      cPassword: req.body.cPassword,
    });

    applySession(req, session);

    return res.json({ success: true, message, redirect });
  } catch (error) {
    return sendError(res, error, "Error in resetting password");
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
