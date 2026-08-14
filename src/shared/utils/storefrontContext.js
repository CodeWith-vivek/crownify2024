const User = require("../../modules/user/userSchema");
const Category = require("../../modules/category/categorySchema");
const Brand = require("../../modules/brand/brandSchema");
const { buildIsValidProduct, computeCartWishlistCounts } = require("./catalogVisibility");

/**
 * Nearly every storefront page needs the same three things before it can
 * render: the listed categories and unblocked brands (to decide what's
 * visible), the signed-in user with their cart and wishlist populated deep
 * enough to filter, and the resulting header badge counts.
 *
 * That meant the same ~35-line block — two lookups, a User.findById with
 * an identical nested double-populate, then buildIsValidProduct +
 * computeCartWishlistCounts — was copy-pasted 17 times across five
 * controllers (8x in userController, 6x in profileController, plus
 * cart/checkout/wallet). The populate shape in particular is easy to get
 * subtly wrong in one copy and not notice, since a missing nested
 * `category` populate doesn't throw — it just silently makes
 * isValidProduct reject every item, zeroing that page's badge counts.
 */

// items.productId must itself populate `category`, because isValidProduct
// checks product.category._id against the listed-category set. Without the
// nested populate, category stays an unpopulated ObjectId, `._id` is
// undefined, and every item silently fails the visibility check.
const CART_WISHLIST_POPULATE = {
  populate: {
    path: "items.productId",
    model: "Product",
    populate: { path: "category", model: "Category" },
  },
};

function findUserWithCartAndWishlist(userId, { withAddresses = false } = {}) {
  const query = User.findById(userId);
  if (withAddresses) query.populate("addresses");
  return query
    .populate({ path: "cart", ...CART_WISHLIST_POPULATE })
    .populate({ path: "wishlist", ...CART_WISHLIST_POPULATE });
}

/**
 * Loads the shared context a storefront page needs.
 *
 * @param {string|null|undefined} userId  req.session.user — may be absent
 *   for a guest, in which case userData is null and both counts are 0.
 * @param {{ withAddresses?: boolean }} [options]  profile-area pages also
 *   render the saved address list, so they opt into that populate.
 * @returns {Promise<{userData, isValidProduct, listedCategories, unblockedBrands, cartCount, wishlistCount}>}
 */
async function loadStorefrontContext(userId, options = {}) {
  const [listedCategories, unblockedBrands, userData] = await Promise.all([
    Category.find({ isListed: true }),
    Brand.find({ isBlocked: false }),
    userId ? findUserWithCartAndWishlist(userId, options) : null,
  ]);

  const isValidProduct = buildIsValidProduct(listedCategories, unblockedBrands);
  const { cartCount, wishlistCount } = computeCartWishlistCounts(userData, isValidProduct);

  return {
    userData,
    isValidProduct,
    listedCategories,
    unblockedBrands,
    cartCount,
    wishlistCount,
  };
}

module.exports = {
  loadStorefrontContext,
  findUserWithCartAndWishlist,
  CART_WISHLIST_POPULATE,
};
