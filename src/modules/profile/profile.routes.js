const express = require("express");
const router = express.Router();
const profileController = require("./profileController");
const { userAuth } = require("../../shared/middlewares/auth");
const preventCache = require("../../shared/middlewares/prevent");
const {
  restrictLoggedInUser,
  allowResetPassword,
  ensureSession,
} = require("../../shared/middlewares/authGuards");

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
router.get("/orders", userAuth, profileController.loadUserOrder);
router.get("/Address", userAuth, profileController.loadUserAddress);
router.get(
  "/AccountDetails",
  userAuth,
  profileController.loadUserAccountDetails
);

module.exports = router;
