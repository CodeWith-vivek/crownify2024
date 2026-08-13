function restrictLoggedInUser(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.status(409).json({ success: false, message: "Already logged in", redirect: "/profile" });
  }
  next();
}
function allowResetPassword(req, res, next) {
  if (req.session.resetAllowed) {
    return next();
  }
  return res.status(403).json({ success: false, message: "Access denied. Please verify OTP first." });
}
const ensureSession = (key, redirectUrl) => {
  return (req, res, next) => {
    if (!req.session[key]) {
      return res.status(401).json({ success: false, message: "Session expired", redirect: redirectUrl });
    }
    next();
  };
};

const preventBackToAuth = async (req, res, next) => {
  if (req.session.user) {
    if (
      req.path === "/verify-otp" ||
      req.path === "/signup" ||
      req.path === "/login"
    ) {
      return res.status(409).json({ success: false, message: "Already logged in", redirect: "/" });
    }
  } else {
    if (req.path === "/verify-otp" && !req.session.userData) {
      return res.status(400).json({ success: false, message: "No signup in progress", redirect: "/signup" });
    }
  }
  next();
};

module.exports = {
  restrictLoggedInUser,
  allowResetPassword,
  ensureSession,
  preventBackToAuth,
};
