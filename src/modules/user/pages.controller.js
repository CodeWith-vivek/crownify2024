const storefrontPagesService = require("./storefrontPages.service");
const { sendError } = require("../../shared/errors/respond");

// HTTP adapters for the storefront content pages. Rules live in
// storefrontPages.service.js.

/**
 * Home/Contact/About/FAQ differ only in whether the payload carries the
 * coupon list and whether the product category is populated, so they share
 * one adapter.
 */
const productPage = (options) => async (req, res) => {
  try {
    const result = await storefrontPagesService.getProductPage({
      userId: req.session.user,
      ...options,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, `Error loading ${options.label} page`);
  }
};

const loadHomepage = productPage({ withCoupons: true, populateCategory: true, label: "home" });
const loadContactpage = productPage({ label: "contact" });
const loadAboutpage = productPage({ withCoupons: true, label: "about" });
const loadFaqpage = productPage({ label: "FAQ" });

const loadBrandpage = async (req, res) => {
  try {
    const result = await storefrontPagesService.getBrandPage({ userId: req.session.user });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error loading brand page");
  }
};

const pageNotFound = async (req, res) => {
  res.status(404).json({ success: false, message: "Page not found" });
};

module.exports = {
  loadHomepage,
  loadContactpage,
  loadAboutpage,
  loadFaqpage,
  loadBrandpage,
  pageNotFound,
};
