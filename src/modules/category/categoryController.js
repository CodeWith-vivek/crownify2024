const categoryService = require("./category.service");
const { sendError } = require("../../shared/errors/respond");

// HTTP adapters for admin category management. Rules live in
// category.service.js. Every route here is behind adminAuth.
//
// The two offer endpoints answer with `status`, not `success`, and a
// refused offer is a 200 carrying `status: false` — the admin UI reads the
// message off the body. Kept as-is so that distinction survives.

const categoryInfo = async (req, res) => {
  try {
    const result = await categoryService.listCategories({
      page: parseInt(req.query.page) || 1,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error fetching category data");
  }
};

const addCategory = async (req, res) => {
  try {
    const result = await categoryService.createCategory({
      name: req.body.name,
      description: req.body.description,
    });
    return res.status(201).json(result);
  } catch (error) {
    // This endpoint answers with `error`, not `message` — the add-category
    // form reads that key.
    if (error.isAppError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error("Error adding category:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
};

const addCategoryOffer = async (req, res) => {
  try {
    const result = await categoryService.applyCategoryOffer({
      categoryId: req.body.categoryId,
      percentage: req.body.percentage,
    });
    return res.json(result);
  } catch (error) {
    return sendError(res, error, "Error adding category offer", { flag: "status" });
  }
};

const removeCategoryOffer = async (req, res) => {
  try {
    const result = await categoryService.clearCategoryOffer({
      categoryId: req.body.categoryId,
    });
    return res.json(result);
  } catch (error) {
    return sendError(res, error, "Error removing category offer", { flag: "status" });
  }
};

const getListCategory = async (req, res) => {
  try {
    // The route is named /listCategory but it UNLISTS — preserved because
    // the admin client calls it by that name.
    const result = await categoryService.setCategoryListed({
      categoryId: req.query.id,
      isListed: false,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Could not unlist category");
  }
};

const getUnlistCategory = async (req, res) => {
  try {
    const result = await categoryService.setCategoryListed({
      categoryId: req.query.id,
      isListed: true,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Could not list category");
  }
};

const getEditCategory = async (req, res) => {
  try {
    const category = await categoryService.getCategory(req.query.id);
    return res.json({ success: true, category });
  } catch (error) {
    return sendError(res, error, "Error loading category");
  }
};

const editCategory = async (req, res) => {
  try {
    const result = await categoryService.updateCategory({
      categoryId: req.params.id,
      name: req.body.categoryName,
      description: req.body.description,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    if (error.isAppError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error("Error editing category:", error);
    return res.status(500).json({ error: "Internal error" });
  }
};

module.exports = {
  categoryInfo,
  addCategory,
  addCategoryOffer,
  removeCategoryOffer,
  getListCategory,
  getUnlistCategory,
  getEditCategory,
  editCategory,
};
