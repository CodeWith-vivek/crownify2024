const wantsJson = (req) =>
  req.originalUrl.startsWith("/api") || req.xhr || req.get("accept")?.includes("json");

function restrictLoggedInUser(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    if (wantsJson(req)) {
      return res.status(409).json({ success: false, message: "Already logged in", redirect: "/profile" });
    }
    return res.redirect("/profile");
  }
  next();
}
function allowResetPassword(req, res, next) {
  if (req.session.resetAllowed) {
    return next();
  }
  const message = "Access denied. Please verify OTP first.";
  if (wantsJson(req)) {
    return res.status(403).json({ success: false, message });
  }
  return res.status(403).send(message);
}
const ensureSession = (key, redirectUrl) => {
  return (req, res, next) => {
    if (!req.session[key]) {
      if (wantsJson(req)) {
        return res.status(401).json({ success: false, message: "Session expired", redirect: redirectUrl });
      }
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
      if (wantsJson(req)) {
        return res.status(409).json({ success: false, message: "Already logged in", redirect: "/" });
      }
      return res.redirect("/");
    }
  } else {
    if (req.path === "/verify-otp" && !req.session.userData) {
      if (wantsJson(req)) {
        return res.status(400).json({ success: false, message: "No signup in progress", redirect: "/signup" });
      }
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
