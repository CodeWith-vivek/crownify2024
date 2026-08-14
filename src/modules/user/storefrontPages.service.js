const Product = require("../product/productSchema");
const Category = require("../category/categorySchema");
const Brand = require("../brand/brandSchema");
const Coupon = require("../coupon/couponSchema");
const { loadStorefrontContext } = require("../../shared/utils/storefrontContext");

// Storefront content pages. Home/Contact/About/FAQ are all the same shape —
// "list the visible products, plus this viewer's header badge counts" — and
// differ only in whether the page also needs the coupon list.

/**
 * @param {{userId, withCoupons?: boolean, populateCategory?: boolean}} args
 */
async function getProductPage({ userId, withCoupons = false, populateCategory = false }) {
  const productQuery = Product.find({ isBlocked: false });
  if (populateCategory) productQuery.populate("category");

  const couponQuery = withCoupons ? Coupon.find({}) : Promise.resolve(undefined);

  // Guests skip the category/brand/user lookups entirely — there are no
  // badge counts to compute and no per-user filtering to apply.
  if (!userId) {
    const [products, coupons] = await Promise.all([productQuery, couponQuery]);
    return {
      products,
      ...(withCoupons ? { coupons } : {}),
      cartCount: 0,
      wishlistCount: 0,
    };
  }

  const [context, products, coupons] = await Promise.all([
    loadStorefrontContext(userId),
    productQuery,
    couponQuery,
  ]);

  return {
    user: context.userData,
    products: products.filter((product) => context.isValidProduct(product)),
    ...(withCoupons ? { coupons } : {}),
    cartCount: context.cartCount,
    wishlistCount: context.wishlistCount,
  };
}

/**
 * The brand page filters at the QUERY level (only products whose category
 * and brand are already visible) rather than fetching everything and
 * filtering in memory, so it doesn't reuse getProductPage.
 */
async function getBrandPage({ userId }) {
  const [listedCategories, unblockedBrands] = await Promise.all([
    Category.find({ isListed: true }),
    Brand.find({ isBlocked: false }),
  ]);

  const products = await Product.find({
    isBlocked: false,
    category: { $in: listedCategories.map((cat) => cat._id) },
    brand: { $in: unblockedBrands.map((brand) => brand.brandName) },
  });

  if (!userId) return { products, cartCount: 0, wishlistCount: 0 };

  const { userData, cartCount, wishlistCount } = await loadStorefrontContext(userId);
  return { user: userData, products, cartCount, wishlistCount };
}

module.exports = { getProductPage, getBrandPage };
