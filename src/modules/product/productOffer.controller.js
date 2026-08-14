const productService = require("./product.service");
const { sendError } = require("../../shared/errors/respond");

// HTTP adapters for offers and storefront visibility. Rules live in
// product.service.js.
//
// The offer endpoints answer with `status`, not `success`, and a refused
// offer is a 200 carrying `status: false` — the admin UI reads the message
// off the body and only shows a generic error when the request itself
// fails. Kept as-is so that distinction survives.

const addProductOffer = async (req, res) => {
  try {
    const result = await productService.applyProductOffer({
      productId: req.body.productId,
      percentage: req.body.percentage,
    });
    return res.json(result);
  } catch (error) {
    return sendError(res, error, "Error applying product offer");
  }
};

const removeProductOffer = async (req, res) => {
  try {
    const result = await productService.clearProductOffer({ productId: req.body.productId });
    return res.json(result);
  } catch (error) {
    return sendError(res, error, "Error removing product offer");
  }
};

const blockProduct = async (req, res) => {
  try {
    const result = await productService.setProductBlocked({
      productId: req.query.id,
      isBlocked: true,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error blocking product");
  }
};

const unblockProduct = async (req, res) => {
  try {
    const result = await productService.setProductBlocked({
      productId: req.query.id,
      isBlocked: false,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error unblocking product");
  }
};

module.exports = { addProductOffer, removeProductOffer, blockProduct, unblockProduct };
