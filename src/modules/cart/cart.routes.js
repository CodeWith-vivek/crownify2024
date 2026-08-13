const express = require("express");
const router = express.Router();
const cartController = require("./cartContoller");
const { userAuth } = require("../../shared/middlewares/auth");

router.get("/cart", userAuth, cartController.loadCartPage);
router.get("/product/:id/stock", cartController.getVarientQuantity);

// These controllers already reject anonymous callers themselves, but only by
// checking that a session exists. userAuth additionally rejects users whose
// account has been blocked by an admin — without it a blocked user could
// still mutate their cart, unlike every other authenticated route.
router.post("/cart/add", userAuth, cartController.addToCart);
router.delete("/cart/remove", userAuth, cartController.deleteFromCart);
router.post("/cart/update", userAuth, cartController.updateCart);

module.exports = router;
