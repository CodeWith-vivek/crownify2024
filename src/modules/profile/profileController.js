// Barrel for the profile module. This file used to BE the module — a
// single 1150-line controller mixing the password-reset flow, address
// CRUD, and the whole signed-in account area. It's now split by concern
// into the files below; this barrel keeps the existing
// `profileController.x` call sites in profile.routes.js working unchanged.
const {
  getForgotPassPage,
  loadOtpPage,
  getResetPassPage,
  forgotEmailValid,
  verifyOtpForgot,
  resendOtpForgot,
  forgotNewPassword,
} = require("./forgotPassword.controller");
const {
  loadAddAddressPage,
  addAddress,
  setPrimaryAddress,
  deleteUserAddress,
  editUserAddress,
  updateUserAddress,
} = require("./address.controller");
const {
  userProfile,
  loadUserAddress,
  loadUserAccountDetails,
  loadUserOrder,
  updateProfileDetails,
  validatCurrentPassword,
} = require("./account.controller");

module.exports = {
  getForgotPassPage,
  forgotEmailValid,
  verifyOtpForgot,
  resendOtpForgot,
  getResetPassPage,
  forgotNewPassword,
  userProfile,
  loadOtpPage,
  loadAddAddressPage,
  addAddress,
  setPrimaryAddress,
  deleteUserAddress,
  editUserAddress,
  updateUserAddress,
  updateProfileDetails,
  validatCurrentPassword,
  loadUserOrder,
  loadUserAddress,
  loadUserAccountDetails,
};
