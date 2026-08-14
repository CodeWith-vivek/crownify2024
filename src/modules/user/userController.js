// Barrel for the user module. This file used to BE the module — a single
// 1213-line controller mixing storefront content pages, the registration/
// OTP flow, session login/logout, and product browsing. It's now split by
// concern into the files below; this barrel keeps the existing
// `userController.x` call sites in user.routes.js working unchanged.
const {
  loadHomepage,
  loadContactpage,
  loadAboutpage,
  loadFaqpage,
  loadBrandpage,
  pageNotFound,
} = require("./pages.controller");
const { getCurrentUser, loadLogin, login, logout } = require("./auth.controller");
const {
  loadSignup,
  loadOtpverify,
  signup,
  verifyOtp,
  resendOtp,
} = require("./signup.controller");
const { loadShopPage, loadProductDetails } = require("./catalog.controller");

module.exports = {
  loadHomepage,
  getCurrentUser,
  pageNotFound,
  loadSignup,
  signup,
  loadOtpverify,
  verifyOtp,
  resendOtp,
  loadLogin,
  login,
  logout,
  loadShopPage,
  loadProductDetails,
  loadBrandpage,
  loadContactpage,
  loadAboutpage,
  loadFaqpage,
};
