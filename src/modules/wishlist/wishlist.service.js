const User = require("../user/userSchema");
const Product = require("../product/productSchema");
const Wishlist = require("./wishlistSchema");
const { loadStorefrontContext } = require("../../shared/utils/storefrontContext");
const { notFound, badRequest } = require("../../shared/errors/AppError");

// Wishlist rules, free of Express.

/**
 * The wishlist card offers a size picker first, then the colours available
 * in that size, so the variants are regrouped by size here rather than in
 * the component.
 */
function groupVariantsBySize(variants = []) {
  return variants.reduce((bySize, variant) => {
    const group = bySize[variant.size] || (bySize[variant.size] = { colors: [], totalQuantity: 0 });
    if (!group.colors.includes(variant.color)) group.colors.push(variant.color);
    group.totalQuantity += variant.quantity;
    return bySize;
  }, {});
}

function toWishlistCard(product) {
  const variants = groupVariantsBySize(product.variants);

  return {
    productId: product._id,
    productName: product.productName,
    productImage: product.productImage?.[0] || "/default-image.jpg",
    brand: product.brand,
    // The Category schema's field is `name`. This read `categoryName`,
    // which no schema defines, so every card fell through to "Unknown".
    category: product.category?.name || "Unknown",
    salePrice: product.salePrice,
    regularPrice: product.regularPrice,
    variants,
    availableSizes: Object.keys(variants),
  };
}

async function getWishlistPage(userId) {
  if (!userId) {
    return { user: null, wishlistItems: [], isWishlistEmpty: true, isGuest: true };
  }

  const [context, wishlist] = await Promise.all([
    loadStorefrontContext(userId),
    Wishlist.findOne({ userId })
      .populate({
        path: "items.productId",
        model: "Product",
        populate: { path: "category", model: "Category" },
      })
      .lean(),
  ]);

  const { userData, isValidProduct, cartCount } = context;

  // Items whose product has since been blocked, unlisted or de-branded are
  // hidden from the page but left on the wishlist document — the same
  // treatment the cart gives them.
  const wishlistItems = (wishlist?.items || [])
    .filter((item) => isValidProduct(item.productId))
    .map((item) => toWishlistCard(item.productId));

  return {
    user: userData,
    wishlistItems,
    isWishlistEmpty: wishlistItems.length === 0,
    isGuest: false,
    cartCount,
    wishlistCount: wishlistItems.length,
  };
}

async function getColorsForSize({ productId, size }) {
  const product = await Product.findById(productId);
  if (!product) throw notFound("Product not found");

  // The same colour can appear more than once in a size when the catalogue
  // has split rows for it, so quantities are summed per colour.
  const byColor = new Map();
  for (const variant of product.variants.filter((v) => v.size === size)) {
    byColor.set(variant.color, (byColor.get(variant.color) || 0) + variant.quantity);
  }

  return { colors: [...byColor].map(([color, quantity]) => ({ color, quantity })) };
}

async function addToWishlist({ userId, productId }) {
  const product = await Product.findById(productId);
  if (!product) throw notFound("Product not found.");

  const user = await User.findById(userId);
  if (!user) throw notFound("User not found.");

  const wishlist = (await Wishlist.findOne({ userId })) || new Wishlist({ userId, items: [] });

  if (wishlist.items.some((item) => item.productId.toString() === productId.toString())) {
    throw badRequest("Product is already in your wishlist.");
  }

  wishlist.items.push({
    productId,
    quantity: 1,
    addedAt: new Date(),
    salePrice: product.salePrice,
    productImage: product.productImage[0] || "",
    category: product.category,
    productDetails: {
      productName: product.productName,
      productBrand: product.brand,
      salePrice: product.salePrice,
      regularPrice: product.regularPrice,
    },
  });

  await wishlist.save();

  if (!user.wishlist.includes(wishlist._id)) {
    user.wishlist.push(wishlist._id);
    await user.save();
  }

  return { message: "Product added to wishlist successfully." };
}

async function removeFromWishlist({ userId, productId }) {
  const wishlist = await Wishlist.findOne({ userId });
  if (!wishlist) throw notFound("Wishlist not found.");

  const itemIndex = wishlist.items.findIndex(
    (item) => item.productId.toString() === productId.toString()
  );
  if (itemIndex === -1) throw notFound("Product not found in wishlist.");

  wishlist.items.splice(itemIndex, 1);
  await wishlist.save();

  // An emptied wishlist is unlinked from the user so the header badge and
  // the "you have a wishlist" checks stay accurate.
  if (wishlist.items.length === 0) {
    await User.updateOne({ _id: userId }, { $pull: { wishlist: wishlist._id } });
  }

  return {
    message: "Product removed from wishlist successfully.",
    wishlistItems: wishlist.items,
  };
}

module.exports = {
  getWishlistPage,
  getColorsForSize,
  addToWishlist,
  removeFromWishlist,
  groupVariantsBySize,
};
