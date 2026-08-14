const Product = require("../product/productSchema");
const Category = require("../category/categorySchema");
const Brand = require("../brand/brandSchema");
const Coupon = require("../coupon/couponSchema");
const { loadStorefrontContext } = require("../../shared/utils/storefrontContext");

// Storefront content pages. Home/Contact/About/FAQ are all the same shape —
// "list the visible products, plus this viewer's header badge counts" —
// and differ only in whether the page also needs the coupon list. They were
// four near-identical 60-line copies; renderProductPage is that shape
// expressed once.

/**
 * @param {object} req
 * @param {object} res
 * @param {{ withCoupons?: boolean, populateCategory?: boolean, label: string }} opts
 */
async function renderProductPage(req, res, opts) {
  const { withCoupons = false, populateCategory = false, label } = opts;
  try {
    const userId = req.session.user;

    const productQuery = Product.find({ isBlocked: false });
    if (populateCategory) productQuery.populate("category");

    // Guests skip the category/brand/user lookups entirely — there are no
    // badge counts to compute and no per-user filtering to apply.
    if (!userId) {
      const [products, coupons] = await Promise.all([
        productQuery,
        withCoupons ? Coupon.find({}) : Promise.resolve(undefined),
      ]);

      return res.json({
        success: true,
        products,
        ...(withCoupons ? { coupons } : {}),
        cartCount: 0,
        wishlistCount: 0,
      });
    }

    const [context, products, coupons] = await Promise.all([
      loadStorefrontContext(userId),
      productQuery,
      withCoupons ? Coupon.find({}) : Promise.resolve(undefined),
    ]);

    const filteredProducts = products.filter((product) => context.isValidProduct(product));

    return res.json({
      success: true,
      user: context.userData,
      products: filteredProducts,
      ...(withCoupons ? { coupons } : {}),
      cartCount: context.cartCount,
      wishlistCount: context.wishlistCount,
    });
  } catch (error) {
    console.error(`Error loading ${label} page:`, error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

const loadHomepage = (req, res) =>
  renderProductPage(req, res, { withCoupons: true, populateCategory: true, label: "home" });

const loadContactpage = (req, res) => renderProductPage(req, res, { label: "contact" });

const loadAboutpage = (req, res) => renderProductPage(req, res, { withCoupons: true, label: "about" });

const loadFaqpage = (req, res) => renderProductPage(req, res, { label: "FAQ" });

// Brand page filters at the QUERY level (only products whose category and
// brand are already visible) rather than fetching everything and filtering
// in memory, so it doesn't reuse renderProductPage above.
const loadBrandpage = async (req, res) => {
  try {
    const userId = req.session.user;

    const [listedCategories, unblockedBrands] = await Promise.all([
      Category.find({ isListed: true }),
      Brand.find({ isBlocked: false }),
    ]);

    const products = await Product.find({
      isBlocked: false,
      category: { $in: listedCategories.map((cat) => cat._id) },
      brand: { $in: unblockedBrands.map((brand) => brand.brandName) },
    });

    if (!userId) {
      return res.json({ success: true, products, cartCount: 0, wishlistCount: 0 });
    }

    const { userData, cartCount, wishlistCount } = await loadStorefrontContext(userId);

    return res.json({
      success: true,
      user: userData,
      products,
      cartCount,
      wishlistCount,
    });
  } catch (error) {
    console.error("Error loading brand page:", error);
    res.status(500).json({ success: false, message: "Server error" });
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
