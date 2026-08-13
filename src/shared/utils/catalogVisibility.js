/**
 * A product can exist in the DB but not be purchasable/visible right now —
 * its own isBlocked flag, its category being unlisted, or its brand being
 * blocked can each hide it independently. Every page that shows a cart or
 * wishlist count (home, shop, cart, checkout, wallet, profile, orders,
 * addresses, account details — nearly the whole logged-in surface) needs to
 * apply this same three-way check before counting an item, so a cart badge
 * doesn't count an item the shopper can no longer actually buy.
 *
 * This used to be copy-pasted inline at 17 call sites across 5 controllers
 * (6 of them in profileController.js alone) — same Set-building, same
 * closure, same filter logic, retyped every time.
 */

function buildIsValidProduct(listedCategories, unblockedBrands) {
  const listedCategoryIds = new Set((listedCategories || []).map((c) => c._id.toString()));
  const unblockedBrandNames = new Set((unblockedBrands || []).map((b) => b.brandName));

  return function isValidProduct(product) {
    return (
      !!product &&
      !product.isBlocked &&
      listedCategoryIds.has(product.category?._id?.toString()) &&
      unblockedBrandNames.has(product.brand)
    );
  };
}

function countValidItems(items, isValidProduct) {
  return items ? items.filter((item) => isValidProduct(item.productId)).length : 0;
}

function computeCartWishlistCounts(userData, isValidProduct) {
  return {
    cartCount: countValidItems(userData?.cart?.[0]?.items, isValidProduct),
    wishlistCount: countValidItems(userData?.wishlist?.[0]?.items, isValidProduct),
  };
}

module.exports = { buildIsValidProduct, countValidItems, computeCartWishlistCounts };
