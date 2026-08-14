const productService = require("./product.service");
const { sendError } = require("../../shared/errors/respond");

// HTTP adapters for the admin read endpoints. Queries live in
// product.service.js.

const getProductAddPage = async (req, res) => {
  try {
    const result = await productService.getAddFormOptions();
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error loading product add page");
  }
};

const getAllProducts = async (req, res) => {
  try {
    // The old handler guarded this response behind `if (category && brand)`
    // with a 404 fallback, but both are arrays from .find() and so always
    // truthy — the fallback was unreachable.
    const result = await productService.listProducts({
      search: req.query.search || "",
      page: parseInt(req.query.page) || 1,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error loading products");
  }
};

const getEditProduct = async (req, res) => {
  try {
    const result = await productService.getEditFormData(req.query.id);
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error loading product");
  }
};

module.exports = { getProductAddPage, getAllProducts, getEditProduct };
