const wishlistService = require("./wishlist.service");
const { sendError } = require("../../shared/errors/respond");

// HTTP adapter only — rules live in wishlist.service.js. Every route here
// is behind userAuth, which already rejects anonymous and blocked users.

const loadWishlistpage = async (req, res) => {
  try {
    const result = await wishlistService.getWishlistPage(req.session.user);
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Wishlist page error");
  }
};

const getColorsBySize = async (req, res) => {
  try {
    const result = await wishlistService.getColorsForSize({
      productId: req.query.productId,
      size: req.query.size,
    });
    return res.json(result);
  } catch (error) {
    // This endpoint answers with `error`, not `success` — kept as-is so the
    // size picker's existing handling still applies.
    if (error.isAppError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error("Error fetching colors:", error);
    return res.status(500).json({ error: "Error fetching colors" });
  }
};

const addToWishlist = async (req, res) => {
  try {
    const result = await wishlistService.addToWishlist({
      userId: req.session.user,
      productId: req.body.productId,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Add to wishlist error");
  }
};

const removeFromWishlist = async (req, res) => {
  try {
    const result = await wishlistService.removeFromWishlist({
      userId: req.session.user,
      productId: req.body.productId,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Remove from wishlist error");
  }
};

module.exports = {
  loadWishlistpage,
  addToWishlist,
  getColorsBySize,
  removeFromWishlist,
};
