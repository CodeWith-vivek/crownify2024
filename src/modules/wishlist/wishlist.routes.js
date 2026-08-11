const express = require("express");
const router = express.Router();
const wishlistController = require("./wishlistController");
const { userAuth } = require("../../shared/middlewares/auth");

router.get("/wishlist", userAuth, wishlistController.loadWishlistpage);
router.post("/wishlist/add", userAuth, wishlistController.addToWishlist);
router.get("/wishlist/colors", userAuth, wishlistController.getColorsBySize);
router.post(
  "/wishlist/remove",
  userAuth,
  wishlistController.removeFromWishlist
);

module.exports = router;
