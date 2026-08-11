const express = require("express");
const router = express.Router();
const brandController = require("./brandController");
const { adminAuth } = require("../../shared/middlewares/auth");
const multer = require("multer");
const multerOptions = require("../../shared/utils/multer");
const uploads = multer(multerOptions);

router.get("/brands", adminAuth, brandController.getBrandPage);
router.post(
  "/addBrand",
  adminAuth,
  uploads.single("image"),
  brandController.addBrand
);
router.get("/blockBrand", adminAuth, brandController.blockBrand);
router.get("/unBlockBrand", adminAuth, brandController.unBlockBrand);
router.get("/deleteBrand", adminAuth, brandController.deleteBrand);

module.exports = router;
