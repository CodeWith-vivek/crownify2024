function restrictLoggedInUser(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.redirect("/profile");
  }
  next();
}
function allowResetPassword(req, res, next) {
  if (req.session.resetAllowed) {
    return next();
  }
  return res.status(403).send("Access denied. Please verify OTP first.");
}
const ensureSession = (key, redirectUrl) => {
  return (req, res, next) => {
    if (!req.session[key]) {
      return res.redirect(redirectUrl);
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
      return res.redirect("/");
    }
  } else {
    if (req.path === "/verify-otp" && !req.session.userData) {
      return res.redirect("/signup");
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
