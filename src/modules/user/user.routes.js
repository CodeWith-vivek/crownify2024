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

router.get("/auth/google", (req, res, next) => {
  req.session.authOrigin = req.query.from || "signup";
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })(req, res, next);
});

router.get(
  "/auth/google/callback",
  (req, res, next) => {
    passport.authenticate("google", {
      failureRedirect:
        req.session.authOrigin === "login"
          ? "/login?error=This email is already associated with a local account. Please log in with that account."
          : "/signup?error=This email is already associated with a local account. Please log in with that account.",
    })(req, res, next);
  },
  async (req, res) => {
    try {
      req.session.user = req.user._id;

      delete req.session.authOrigin;
      return res.redirect("/?success=Login successful!");
    } catch (error) {
      console.log("Error during Google authentication:", error);

      const errorPath =
        req.session.authOrigin === "login" ? "/login" : "/signup";
      delete req.session.authOrigin;
      return res.redirect(
        `${errorPath}?error=Something went wrong. Please try again.`
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
