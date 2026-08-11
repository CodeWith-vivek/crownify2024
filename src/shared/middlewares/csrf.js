const crypto = require("crypto");

const COOKIE_NAME = "XSRF-TOKEN";
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const issueToken = (req, res, next) => {
  let token = req.cookies[COOKIE_NAME];
  if (!token) {
    token = crypto.randomBytes(32).toString("hex");
    res.cookie(COOKIE_NAME, token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 72 * 60 * 60 * 1000,
    });
  }
  res.locals.csrfToken = token;
  next();
};

const verifyToken = (req, res, next) => {
  if (!UNSAFE_METHODS.has(req.method)) return next();
  // multipart/form-data uploads (admin product/brand image forms) submit via
  // native form.submit() calls, which bypass both the submit-event listener
  // and fetch/XHR in csrf.js, and multer parses the body after this
  // middleware runs — so the token can never arrive here for those routes.
  // Those endpoints are already gated by adminAuth session middleware.
  if (req.is("multipart/form-data")) return next();

  const cookieToken = req.cookies[COOKIE_NAME];
  const suppliedToken = req.headers["x-csrf-token"] || (req.body && req.body._csrf);

  if (!cookieToken || !suppliedToken || cookieToken !== suppliedToken) {
    if (req.xhr || req.headers.accept?.includes("application/json")) {
      return res.status(403).json({ success: false, message: "Invalid or missing CSRF token" });
    }
    req.flash("error", "Your session expired, please try again.");
    return res.redirect(req.get("Referrer") || "/");
  }
  next();
};

module.exports = { issueToken, verifyToken };
