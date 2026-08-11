const express = require("express");
const router = express.Router();
const cartController = require("./cartContoller");
const { userAuth } = require("../../shared/middlewares/auth");

router.get("/cart", userAuth, cartController.loadCartPage);
router.get("/product/:id/stock", cartController.getVarientQuantity);

router.post("/cart/add", cartController.addToCart);
router.delete("/cart/remove", cartController.deleteFromCart);
router.post("/cart/update", cartController.updateCart);

module.exports = router;
