const express = require("express");


const router = express.Router();
const userController = require("../controllers/userController");
const cartController = require("../controllers/cartContoller");
const passport = require("passport");
const profileController = require("../controllers/profileController");
const checkoutController = require("../controllers/checkoutController");
const { userAuth } = require("../middlewares/auth");
const preventCache = require("../middlewares/prevent");
const orderController = require("../controllers/orderController");
const contactController = require("../controllers/contactController");
const wishlistController = require("../controllers/wishlistController");
const couponController = require("../controllers/couponController");
const rollbackCoupon = require("../middlewares/rollbackCoupon");
const walletController = require("../controllers/walletController");
const paymentController=require("../controllers/paymentController")
const userCheckController=require("../controllers/userAccess")
const reportController = require("../controllers/reportController");
const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage: storage });

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

router.get("/pageNotFound", userController.pageNotFound);

//user signup managing
router.get("/check-block-status",userCheckController.userCheck);
router.get("/", userController.loadHomepage);
router.get("/brand", userController.loadBrandpage);
router.post("/contact", contactController.submitContactForm);
router.get("/contact", userController.loadContactpage);
router.get("/About", userController.loadAboutpage);
router.get("/faq", userController.loadFaqpage);
router.get(
  "/signup",
  preventCache,
  preventBackToAuth,
  userController.loadSignup
);
router.post("/signup", userController.signup);
router.get(
  "/verify-otp",
  preventCache,
  preventBackToAuth,
  userController.loadOtpverify
);
router.post("/verify-otp", userController.verifyOtp);
router.post("/resend-otp", userController.resendOtp);
router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: (req, res) => {
      // Check if the source is 'login' and redirect accordingly
      const source = req.query.source;
      if (source === "login") {
        return "/login?error=Google account already exists. Please use a different account or log in.";
      }
      return "/signup?error=Google account already exists. Please use a different account or log in.";
    },
  }),
  async (req, res) => {
    try {
      req.session.user = req.user._id;
      return res.redirect("/?success=Login successful!");
    } catch (error) {
      console.log("Error during Google login:", error);
      return res.redirect(
        "/login?error=Something went wrong. Please try again."
      );
    }
  }
);
// router.get(
//   "/auth/google/callback",
//   passport.authenticate("google", {
//     failureRedirect:
//       "/signup?error=Google account already exists. Please use a different account or log in.",
//   }),
//   async (req, res) => {
//     try {
//       req.session.user = req.user._id;
//       return res.redirect("/?success=Login successful!");
//     } catch (error) {
//       console.log("Error during Google login:", error);
//       return res.redirect(
//         "/login?error=Something went wrong. Please try again."
//       );
//     }
//   }
// );

// router.get("/auth/google/callback", (req, res, next) => {
//   passport.authenticate("google", async (err, user, info) => {
//     if (err) {
//       return next(err);
//     }
//     if (!user) {
//       // Return JSON response for failed login
//       return res.json({
//         success: false,
//         message: info.message || "Authentication failed. Please try again.",
//       });
//     }

//     // Successful login
//     req.session.user = user._id;
//     return res.json({
//       success: true,
//       message: "Login successful",
//     });
//   })(req, res, next);
// });

// router.get("/auth/google/callback", async (req, res, next) => {
//   passport.authenticate("google", { failureRedirect: "/signup" })(
//     req,
//     res,
//     async (err) => {
//       if (err || !req.user) {
//         // If there is an error or user is not authenticated
//         if (
//           err &&
//           err.message ===
//             "This email is already associated with a local account. Please log in with that account."
//         ) {
//           return res.status(400).json({ success: false, message: err.message });
//         }
//         return res.redirect("/signup"); // Redirect to signup on general errors
//       }

//       try {
//         req.session.user = req.user._id;
//         return res.redirect("/"); // Redirect to the home page on successful login
//       } catch (error) {
//         console.log("Error during Google login:", error);
//         return res
//           .status(500)
//           .json({
//             success: false,
//             message: "Something went wrong. Please try again.",
//           });
//       }
//     }
//   );
// });

// router.get(
//   "/auth/google/callback",
//   passport.authenticate("google", {
//     failureRedirect: "/signup",
//     failureFlash:
//       "Google account already exists. Please use a different account or log in.",
//   }),
//   async (req, res) => {
//     try {
//       req.session.user = req.user._id;
//       return res.redirect("/");
//     } catch (error) {
//       console.log("Error during Google login:", error);
//       req.flash("error", "Something went wrong. Please try again.");
//       return res.redirect("/login");
//     }
//   }
// );

// router.get(
//   "/auth/google",
//   passport.authenticate("google", { scope: ["profile", "email"] })
// );

// router.get(
//   "/auth/google/callback",
//   passport.authenticate("google", {
//     failureRedirect: "/signup",
//     failureMessage: true,
//     failureFlash: true,
//   }),
//   async (req, res) => {
//     try {
//       // Check for existing user with email
//       const existingUser = await User.findOne({ email: req.user.email });

//       if (existingUser) {
//         if (!existingUser.googleId) {
//           // User exists but registered with normal signup
//           return res.redirect("/signup?errorType=normal_signup");
//         } else if (existingUser.googleId !== req.user.googleId) {
//           // User exists with different Google account
//           return res.redirect("/signup?errorType=google_exists");
//         }
//       }

//       // If all checks pass, set up session and redirect
//       req.session.user = {
//         _id: req.user._id,
//         name: req.user.name,
//         email: req.user.email,
      
//       };

//       return res.redirect("/?success=true");
//     } catch (error) {
//       console.log("Error during Google login:", error);
//       return res.redirect("/signup?errorType=error");
//     }
//   }
// );



//user login managing

router.get(
  "/login",
  preventCache,
  preventBackToAuth,
  restrictLoggedInUser,
  userController.loadLogin
);
router.post("/login", preventCache, restrictLoggedInUser, userController.login);

//shop & home logout management

router.get("/logout", userController.logout);
router.get("/shop", userController.loadShopPage);
router.get("/product/:id", userController.loadProductDetails);

// user profile management

router.get(
  "/forget-password",
  preventCache,
  restrictLoggedInUser,
  profileController.getForgotPassPage
);
router.post(
  "/forget-email-valid",
  restrictLoggedInUser,
  profileController.forgotEmailValid
);
router.get("/otp-page", restrictLoggedInUser, profileController.loadOtpPage);
router.post(
  "/verify-otp-forgot",
  restrictLoggedInUser,
  profileController.verifyOtpForgot
);
router.post(
  "/resend-otp-forgot",
  restrictLoggedInUser,
  profileController.resendOtpForgot
);
router.get(
  "/reset-password",
  restrictLoggedInUser,
  preventCache,
  ensureSession("email", "/login"),

  allowResetPassword,

  profileController.getResetPassPage
);
router.post(
  "/reset-password",
  restrictLoggedInUser,
  preventCache,
  allowResetPassword,

  profileController.forgotNewPassword
);
router.get("/profile", userAuth, profileController.userProfile);
router.get("/user/addAddress", userAuth, profileController.loadAddAddressPage);
router.post("/addAddress", userAuth, profileController.addAddress);
router.post(
  "/set-primary-address/:id",
  userAuth,
  profileController.setPrimaryAddress
);
router.post(
  "/delete-address/:id",
  userAuth,
  profileController.deleteUserAddress
);

router.get("/edit-address/:id", userAuth, profileController.editUserAddress);
router.post(
  "/update-address/:id",
  userAuth,
  profileController.updateUserAddress
);
router.post("/update-user", userAuth, profileController.updateProfileDetails);
router.post(
  "/validate-current-password",
  userAuth,
  profileController.validatCurrentPassword
);
router.post("/cancel-item", userAuth, orderController.cancelOrder);
router.post("/return-item", userAuth, orderController.returnItem);
router.post("/cancel-return-request", userAuth, orderController.cancelReturn);
router.get("/orders", userAuth, profileController.loadUserOrder);
router.get("/Address", userAuth, profileController.loadUserAddress);
router.get(
  "/AccountDetails",
  userAuth,
  profileController.loadUserAccountDetails
);

//user wishlist
router.get("/wishlist", userAuth,wishlistController.loadWishlistpage);
router.post("/wishlist/add",userAuth, wishlistController.addToWishlist);
router.get("/wishlist/colors", userAuth,wishlistController.getColorsBySize);
router.post("/wishlist/remove", userAuth,wishlistController.removeFromWishlist);

//user wallet
router.get("/wallet", userAuth, walletController.loadwalletpage);
router.post("/wallet/add-money", userAuth, walletController.addMoneyToWallet);
router.get("/wallet/balance", userAuth, walletController.getWalletBalance);
router.post("/confirm-payment",userAuth,walletController.confirmPayment);



//user cartManagement

router.get("/cart", userAuth,cartController.loadCartPage);
router.get("/product/:id/stock", cartController.getVarientQuantity);

router.post("/cart/add", cartController.addToCart);
router.delete("/cart/remove", cartController.deleteFromCart);
router.post("/cart/update", cartController.updateCart);
router.get(
  "/checkout",
  userAuth,
  (req, res, next) => {
  
    req.session.isCheckoutPage = true;
    next();
  },
  rollbackCoupon,
  checkoutController.loadCheckout
);
router.post(
  "/checkout/validate",
  userAuth,
  checkoutController.validateQuantity
);


//order

router.post("/checkout", userAuth, orderController.placeOrder);
router.post("/verify-payment", userAuth, orderController.verifyRazorpayPayment);

router.post("/apply-coupon", userAuth, couponController.couponApply);
router.post("/remove-coupon", userAuth, couponController.removeCoupon); 

router.get("/payment-Success",userAuth,paymentController.loadPayment);
router.get("/payment-Failure", userAuth, paymentController.loadFailure);
router.post("/payment-failure",userAuth,paymentController.paymentFailure)
router.post("/retry-payment",userAuth,paymentController.retryPayment)

router.post("/delete-preliminary-order",userAuth,orderController.deletepremilinaryOrder);
router.get("/invoice/:orderId",userAuth,reportController.generateInvoicePDF);
router.post("/update-order-status", userAuth,paymentController.updateOrderStatus);
router.get('/get-order-details/:orderNumber',userAuth,paymentController.getOrderDetails)

module.exports = router;

