const brandService = require("./brand.service");
const { sendError } = require("../../shared/errors/respond");

// HTTP adapters for admin brand management. Rules live in
// brand.service.js. Every route here is behind adminAuth.

const getBrandPage = async (req, res) => {
  try {
    const result = await brandService.listBrands({ page: parseInt(req.query.page) || 1 });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error loading brands");
  }
};

const addBrand = async (req, res) => {
  try {
    const result = await brandService.createBrand({ name: req.body.name, file: req.file });
    return res.status(201).json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error adding brand");
  }
};

const blockBrand = async (req, res) => {
  try {
    const result = await brandService.setBrandBlocked({
      brandId: req.query.id,
      isBlocked: true,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Could not block brand");
  }
};

const unBlockBrand = async (req, res) => {
  try {
    const result = await brandService.setBrandBlocked({
      brandId: req.query.id,
      isBlocked: false,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Could not unblock brand");
  }
};

const deleteBrand = async (req, res) => {
  try {
    const result = await brandService.deleteBrand(req.query.id);
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error deleting brand");
  }
};

module.exports = { getBrandPage, addBrand, blockBrand, unBlockBrand, deleteBrand };
