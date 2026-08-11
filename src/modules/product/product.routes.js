const express = require("express");
const router = express.Router();
const productController = require("./productController");
const { adminAuth } = require("../../shared/middlewares/auth");
const multer = require("multer");
const multerOptions = require("../../shared/utils/multer");
const uploads = multer(multerOptions);

router.get("/addProducts", adminAuth, productController.getProductAddPage);
router.post(
  "/addProducts",
  adminAuth,
  uploads.array("images", 4),
  productController.addProducts
);
router.get("/products", adminAuth, productController.getAllProducts);
router.post("/addProductOffer", adminAuth, productController.addProductOffer);
router.post(
  "/removeProductOffer",
  adminAuth,
  productController.removeProductOffer
);
router.get("/blockProduct", adminAuth, productController.blockProduct);
router.get("/unblockProduct", adminAuth, productController.unblockProduct);
router.get("/editProduct", adminAuth, productController.getEditProduct);
router.post(
  "/editProduct/:id",
  adminAuth,
  uploads.array("images", 4),
  productController.editProduct
);
router.post("/deleteImage", adminAuth, productController.deleteSingleImage);

module.exports = router;
