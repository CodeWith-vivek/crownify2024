const express = require("express");
const router = express.Router();
const walletController = require("./walletController");
const { userAuth } = require("../../shared/middlewares/auth");

router.get("/wallet", userAuth, walletController.loadwalletpage);
router.post("/wallet/add-money", userAuth, walletController.addMoneyToWallet);
router.get("/wallet/balance", userAuth, walletController.getWalletBalance);
router.post("/confirm-payment", userAuth, walletController.confirmPayment);

module.exports = router;
