const {
  buildIsValidProduct,
  countValidItems,
  computeCartWishlistCounts,
} = require("../../src/shared/utils/catalogVisibility");

const listedCategories = [{ _id: "cat1" }];
const unblockedBrands = [{ brandName: "Acme" }];

describe("buildIsValidProduct", () => {
  const isValidProduct = buildIsValidProduct(listedCategories, unblockedBrands);

  test("valid when unblocked, listed category, unblocked brand", () => {
    const product = { isBlocked: false, category: { _id: "cat1" }, brand: "Acme" };
    expect(isValidProduct(product)).toBe(true);
  });

  test("invalid when the product itself is blocked", () => {
    const product = { isBlocked: true, category: { _id: "cat1" }, brand: "Acme" };
    expect(isValidProduct(product)).toBe(false);
  });

  test("invalid when the category isn't in the listed set", () => {
    const product = { isBlocked: false, category: { _id: "cat-unlisted" }, brand: "Acme" };
    expect(isValidProduct(product)).toBe(false);
  });

  test("invalid when the brand isn't in the unblocked set", () => {
    const product = { isBlocked: false, category: { _id: "cat1" }, brand: "BlockedBrand" };
    expect(isValidProduct(product)).toBe(false);
  });

  test("invalid for a null/undefined product (e.g. hard-deleted productId ref)", () => {
    expect(isValidProduct(null)).toBe(false);
    expect(isValidProduct(undefined)).toBe(false);
  });
});

describe("countValidItems", () => {
  const isValidProduct = buildIsValidProduct(listedCategories, unblockedBrands);

  test("counts only items whose productId passes the check", () => {
    const items = [
      { productId: { isBlocked: false, category: { _id: "cat1" }, brand: "Acme" } },
      { productId: { isBlocked: true, category: { _id: "cat1" }, brand: "Acme" } },
    ];
    expect(countValidItems(items, isValidProduct)).toBe(1);
  });

  test("returns 0 for undefined/empty items rather than throwing", () => {
    expect(countValidItems(undefined, isValidProduct)).toBe(0);
    expect(countValidItems([], isValidProduct)).toBe(0);
  });
});

describe("computeCartWishlistCounts", () => {
  const isValidProduct = buildIsValidProduct(listedCategories, unblockedBrands);
  const validItem = { productId: { isBlocked: false, category: { _id: "cat1" }, brand: "Acme" } };

  test("reads from userData.cart[0].items and userData.wishlist[0].items", () => {
    const userData = {
      cart: [{ items: [validItem, validItem] }],
      wishlist: [{ items: [validItem] }],
    };
    expect(computeCartWishlistCounts(userData, isValidProduct)).toEqual({ cartCount: 2, wishlistCount: 1 });
  });

  test("guest / no cart or wishlist document at all -> zeros, not a throw", () => {
    expect(computeCartWishlistCounts(null, isValidProduct)).toEqual({ cartCount: 0, wishlistCount: 0 });
    expect(computeCartWishlistCounts({}, isValidProduct)).toEqual({ cartCount: 0, wishlistCount: 0 });
  });
});
