const express=require("express")

const router=express.Router()
const userController =require("../controllers/userController");
const cartController =require("../controllers/cartContoller")
const passport = require("passport");
const profileController =require("../controllers/profileController")
const {userAuth}=require("../middlewares/auth")
const preventCache=require("../middlewares/prevent")
function restrictLoggedInUser(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    // Redirect to a specific page if the user is already logged in
    return res.redirect("/profile");
  }
  next(); // Continue to the requested route if the user is not logged in
}
const preventBackToAuth = async (req, res, next) => {
  if (req.session.user) {
    // If user is logged in and trying to access auth pages
    if (
      req.path === "/verify-otp" ||
      req.path === "/signup" ||
      req.path === "/login"
    ) {
      return res.redirect("/");
    }
  } else {
    // If user is not logged in and trying to access OTP page directly
    if (req.path === "/verify-otp" && !req.session.userData) {
      return res.redirect("/signup");
    }
  }
  next();
};

router.get("/pageNotFound", userController.pageNotFound);

//user signup managing

router.get("/",userController.loadHomepage)
router.get("/signup",preventCache,preventBackToAuth,userController.loadSignup)
router.post("/signup", userController.signup);
router.get("/verify-otp",preventCache,preventBackToAuth,userController.loadOtpverify)
router.post("/verify-otp", userController.verifyOtp);
router.post("/resend-otp", userController.resendOtp);
router.get("/auth/google",passport.authenticate("google",{scope:["profile","email"]}))

router.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/signup",
    failureFlash:
      "Google account already exists. Please use a different account or log in.",
  }),
  async (req, res) => {
    try {
     
      req.session.user = req.user._id; 
      return res.redirect("/"); 
    } catch (error) {
      console.log("Error during Google login:", error);
      req.flash("error", "Something went wrong. Please try again.");
      return res.redirect("/login");
    }
  }
);

//user login managing

router.get("/login",preventCache,preventBackToAuth,restrictLoggedInUser, userController.loadLogin);
router.post("/login", preventCache,restrictLoggedInUser,userController.login);

//shop & home logout management

router.get("/logout",userController.logout)
router.get("/shop", userController.loadShopPage);

router.get("/product/:id", userController.loadProductDetails);

// user profile management

router.get("/forget-password",preventCache,restrictLoggedInUser,profileController.getForgotPassPage)
router.post("/forget-email-valid",restrictLoggedInUser,profileController.forgotEmailValid)
router.get("/otp-page",restrictLoggedInUser,profileController.loadOtpPage)
router.post("/verify-otp-forgot",restrictLoggedInUser,profileController.verifyOtpForgot);
router.post("/resend-otp-forgot",restrictLoggedInUser,profileController.resendOtpForgot)
router.get("/reset-password",restrictLoggedInUser,preventCache,profileController.getResetPassPage)
router.post("/reset-password",restrictLoggedInUser,preventCache,profileController.forgotNewPassword)
router.get("/profile", userAuth, profileController.userProfile) 
  router.get("/user/addAddress",userAuth, profileController.loadAddAddressPage);
  router.post("/addAddress",userAuth,profileController.addAddress);

//user cartManagement

router.get("/cart",cartController.loadCartPage)
router.get("/product/:id/stock", cartController.getVarientQuantity);
router.get("/product/:id/overall-stock", cartController.getOverallStock);
router.post("/cart/add",cartController.addToCart);
router.delete("/cart/remove", cartController.deleteFromCart);
router.post("/cart/update",cartController.updateCart)


module.exports=router

