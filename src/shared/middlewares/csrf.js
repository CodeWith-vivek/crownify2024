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

  // NOTE: multipart/form-data used to be exempt here, because the EJS admin
  // upload forms submitted via native form.submit() (bypassing the fetch/XHR
  // interception that attached the token) and multer parses the body after
  // this middleware, so req.body._csrf was never populated in time.
  //
  // The React client sends every upload through apiClient.uploadForm(), which
  // sets the X-CSRF-Token *header* — and headers are readable here regardless
  // of multer. There is no native form submission left in the app, so the
  // exemption is no longer needed and is enforced like any other unsafe
  // request. This closes a CSRF hole on the three admin upload endpoints
  // (addBrand, addProducts, editProduct).

  const cookieToken = req.cookies[COOKIE_NAME];
  const suppliedToken = req.headers["x-csrf-token"] || (req.body && req.body._csrf);

  if (!cookieToken || !suppliedToken || cookieToken !== suppliedToken) {
    return res.status(403).json({ success: false, message: "Invalid or missing CSRF token" });
  }
  next();
};

module.exports = { issueToken, verifyToken };
