const express=require("express")

const router=express.Router()
const userController =require("../controllers/userController");
const cartController =require("../controllers/cartContoller")
const passport = require("passport");
const profileController =require("../controllers/profileController")
const checkoutController=require("../controllers/checkoutController")
const {userAuth}=require("../middlewares/auth")
const preventCache=require("../middlewares/prevent")
const orderController=require("../controllers/orderController")
const contactController = require("../controllers/contactController");
const wishlistController=require("../controllers/wishlistController")
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

router.get("/",userController.loadHomepage)
router.get("/brand", userController.loadBrandpage);
router.post("/contact", contactController.submitContactForm);
router.get("/contact", userController.loadContactpage);
router.get("/About", userController.loadAboutpage);
router.get("/faq", userController.loadFaqpage);
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
  router.post("/set-primary-address/:id",userAuth,profileController.setPrimaryAddress);
  router.post("/delete-address/:id",userAuth,profileController.deleteUserAddress)
  
  router.get("/edit-address/:id",userAuth,profileController.editUserAddress);
  router.post("/update-address/:id", userAuth,profileController.updateUserAddress);
router.post("/update-user",userAuth,profileController.updateProfileDetails);
router.post("/validate-current-password",userAuth,profileController.validatCurrentPassword);
router.post("/cancel-item",userAuth,orderController.cancelOrder)
router.post("/return-item",userAuth,orderController.returnItem)
router.get("/orders", userAuth, profileController.loadUserOrder);
router.get("/Address",userAuth,profileController.loadUserAddress)
router.get("/AccountDetails",userAuth,profileController.loadUserAccountDetails)

//user wishlist
router.get("/wishlist",wishlistController.loadWishlistpage)
router.post("/wishlist/add", wishlistController.addToWishlist);
router.get("/wishlist/colors", wishlistController.getColorsBySize);
router.post("/wishlist/remove", wishlistController.removeFromWishlist);






//user cartManagement

router.get("/cart",cartController.loadCartPage)
router.get("/product/:id/stock", cartController.getVarientQuantity);

router.post("/cart/add",cartController.addToCart);
router.delete("/cart/remove", cartController.deleteFromCart);
router.post("/cart/update",cartController.updateCart)
router.get("/checkout", userAuth, checkoutController.loadCheckout);
router.post('/checkout/validate',userAuth,checkoutController.validateQuantity)

//order

router.post("/checkout",userAuth,orderController.placeOrder)
router.post("/verify-payment", userAuth, orderController.verifyRazorpayPayment);





module.exports=router

