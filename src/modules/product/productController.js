// Barrel for the product module — split by concern into the files below;
// keeps the existing `productController.x` call sites in
// product.routes.js working unchanged.
const {
  getProductAddPage,
  getAllProducts,
  getEditProduct,
} = require("./productQuery.controller");
const { addProducts, editProduct, deleteSingleImage } = require("./productCrud.controller");
const {
  addProductOffer,
  removeProductOffer,
  blockProduct,
  unblockProduct,
} = require("./productOffer.controller");

module.exports = {
  getProductAddPage,
  addProducts,
  getAllProducts,
  addProductOffer,
  removeProductOffer,
  blockProduct,
  unblockProduct,
  getEditProduct,
  editProduct,
  deleteSingleImage,
};
