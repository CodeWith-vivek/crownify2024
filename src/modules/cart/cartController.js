const cartService = require("./cart.service");
const { sendError } = require("../../shared/errors/respond");

// HTTP adapter only — rules live in cart.service.js. Every route here is
// behind userAuth, which already rejects anonymous and blocked users, so
// these handlers can assume req.session.user is a live account.

const loadCartPage = async (req, res) => {
  try {
    const result = await cartService.getCartPage(req.session.user);
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Cart page error");
  }
};

const addToCart = async (req, res) => {
  try {
    const result = await cartService.addToCart({
      userId: req.session.user,
      productId: req.body.productId,
      size: req.body.size,
      color: req.body.color,
      quantity: req.body.quantity,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error adding to cart");
  }
};

const getVarientQuantity = async (req, res) => {
  try {
    const result = await cartService.getVariantStock({
      productId: req.params.id,
      size: req.query.size,
      color: req.query.color,
    });
    return res.json(result);
  } catch (error) {
    return sendError(res, error, "Error fetching stock");
  }
};

const deleteFromCart = async (req, res) => {
  try {
    const result = await cartService.removeFromCart({
      userId: req.session.user,
      productId: req.body.productId,
      size: req.body.size,
      color: req.body.color,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error removing item from cart");
  }
};

const updateCart = async (req, res) => {
  try {
    const result = await cartService.updateCartQuantity({
      userId: req.session.user,
      productId: req.body.productId,
      size: req.body.size,
      color: req.body.color,
      quantity: req.body.quantity,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error updating cart");
  }
};

module.exports = {
  loadCartPage,
  addToCart,
  getVarientQuantity,
  deleteFromCart,
  updateCart,
};
