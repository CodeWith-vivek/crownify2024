const catalogService = require("./catalog.service");
const { sendError } = require("../../shared/errors/respond");

// HTTP adapters for product browsing. Rules live in catalog.service.js.

const loadShopPage = async (req, res) => {
  try {
    const result = await catalogService.getShopPage({
      userId: req.session.user,
      query: req.query,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error in loadShopPage");
  }
};

const loadProductDetails = async (req, res) => {
  try {
    const result = await catalogService.getProductDetails({
      userId: req.session.user,
      productId: req.params.id,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error loading product details");
  }
};

module.exports = { loadShopPage, loadProductDetails };
