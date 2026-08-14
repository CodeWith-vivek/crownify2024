const productService = require("./product.service");
const { sendError } = require("../../shared/errors/respond");

// HTTP adapters for the admin write endpoints. Rules live in
// product.service.js.

const addProducts = async (req, res) => {
  try {
    const result = await productService.createProduct({ body: req.body, files: req.files });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error saving product");
  }
};

const editProduct = async (req, res) => {
  try {
    const result = await productService.updateProduct({
      productId: req.params.id,
      updates: req.body,
      files: req.files,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error updating product");
  }
};

const deleteSingleImage = async (req, res) => {
  try {
    await productService.removeProductImage({
      productId: req.body.productIdToServer,
      imageUrl: req.body.imageNameToServer,
    });
    return res.json({ status: true, success: true });
  } catch (error) {
    console.error("Error deleting product image:", error);
    return res
      .status(500)
      .json({ status: false, success: false, message: "Could not delete image" });
  }
};

module.exports = { addProducts, editProduct, deleteSingleImage };
