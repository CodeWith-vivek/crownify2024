const express = require("express");
const router = express.Router();
const passport = require("passport");
const userController = require("./userController");
const userCheckController = require("./userAccess");
const preventCache = require("../../shared/middlewares/prevent");
const {
  restrictLoggedInUser,
  preventBackToAuth,
} = require("../../shared/middlewares/authGuards");
const { authLimiter, otpLimiter } = require("../../shared/middlewares/rateLimiters");

router.get("/pageNotFound", userController.pageNotFound);
router.get("/auth/me", userController.getCurrentUser);

//user signup managing
router.get("/check-block-status", userCheckController.userCheck);
router.get("/", userController.loadHomepage);
router.get("/brand", userController.loadBrandpage);
router.get("/contact", userController.loadContactpage);
router.get("/About", userController.loadAboutpage);
router.get("/faq", userController.loadFaqpage);
router.get(
  "/signup",
  preventCache,
  preventBackToAuth,
  userController.loadSignup
);
router.post("/signup", authLimiter, userController.signup);
router.get(
  "/verify-otp",
  preventCache,
  preventBackToAuth,
  userController.loadOtpverify
);
router.post("/verify-otp", otpLimiter, userController.verifyOtp);
router.post("/resend-otp", otpLimiter, userController.resendOtp);

// Where the browser should land after the OAuth round-trip. In production the
// API and the built client share an origin, so a relative redirect is correct
// and CLIENT_ORIGIN stays unset. In development the client is served by Vite
// on a different port, so a relative redirect would strand the user on the
// API origin (showing a stale client/dist build) — set CLIENT_ORIGIN to the
// Vite URL there.
const CLIENT_ORIGIN = (process.env.CLIENT_ORIGIN || "").replace(/\/$/, "");
const clientUrl = (path) => `${CLIENT_ORIGIN}${path}`;

router.get("/auth/google", (req, res, next) => {
  req.session.authOrigin = req.query.from || "signup";
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })(req, res, next);
});

router.get(
  "/auth/google/callback",
  (req, res, next) => {
    const conflictMessage =
      "This email is already associated with a local account. Please log in with that account.";
    passport.authenticate("google", {
      failureRedirect:
        req.session.authOrigin === "login"
          ? clientUrl(`/login?error=${encodeURIComponent(conflictMessage)}`)
          : clientUrl(`/signup?error=${encodeURIComponent(conflictMessage)}`),
    })(req, res, next);
  },
  async (req, res) => {
    try {
      req.session.user = req.user._id;

      delete req.session.authOrigin;
      return res.redirect(clientUrl(`/?success=${encodeURIComponent("Login successful!")}`));
    } catch (error) {
      console.log("Error during Google authentication:", error);

      const errorPath =
        req.session.authOrigin === "login" ? "/login" : "/signup";
      delete req.session.authOrigin;
      return res.redirect(
        clientUrl(`${errorPath}?error=${encodeURIComponent("Something went wrong. Please try again.")}`)
      );
    }
  }
);

//user login managing

router.get(
  "/login",
  preventCache,
  preventBackToAuth,
  restrictLoggedInUser,
  userController.loadLogin
);
router.post(
  "/login",
  authLimiter,
  preventCache,
  restrictLoggedInUser,
  userController.login
);

//shop & home logout management

router.get("/logout", userController.logout);
router.get("/shop", userController.loadShopPage);
router.get("/product/:id", userController.loadProductDetails);

module.exports = router;
