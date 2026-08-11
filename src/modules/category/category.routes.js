const express = require("express");
const router = express.Router();
const categoryController = require("./categoryController");
const { adminAuth } = require("../../shared/middlewares/auth");

router.get("/category", adminAuth, categoryController.categoryInfo);
router.post("/addCategory", adminAuth, categoryController.addCategory);
router.post(
  "/addCategoryOffer",
  adminAuth,
  categoryController.addCategoryOffer
);
router.post(
  "/removeCategoryOffer",
  adminAuth,
  categoryController.removeCategoryOffer
);
router.get("/listCategory", adminAuth, categoryController.getListCategory);
router.get(
  "/unlistCategory",
  adminAuth,
  categoryController.getUnlistCategory
);
router.get("/editCategory", adminAuth, categoryController.getEditCategory);
router.put("/editCategory/:id", adminAuth, categoryController.editCategory);

module.exports = router;
