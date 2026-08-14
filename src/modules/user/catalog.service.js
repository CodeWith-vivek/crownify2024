const Product = require("../product/productSchema");
const Category = require("../category/categorySchema");
const Brand = require("../brand/brandSchema");
const User = require("./userSchema");
const {
  buildIsValidProduct,
  computeCartWishlistCounts,
} = require("../../shared/utils/catalogVisibility");
const { loadStorefrontContext } = require("../../shared/utils/storefrontContext");
const { notFound } = require("../../shared/errors/AppError");

// Product browsing rules, free of Express: the filterable shop listing and
// the product detail page.

const PRODUCTS_PER_PAGE = 12;
const RELATED_PRODUCTS_SHOWN = 4;

const SORT_OPTIONS = {
  priceLowHigh: { salePrice: 1 },
  priceHighLow: { salePrice: -1 },
  alphaAsc: { productName: 1 },
  alphaDesc: { productName: -1 },
  newArrivals: { createdAt: -1 },
  popularity: { popularity: -1 },
};

const DEFAULT_SORT = { createdAt: -1 };

const asArray = (value) => (value === undefined || value === null ? [] : [].concat(value));

const discountPercent = (product) =>
  product.regularPrice > 0
    ? Math.round(((product.regularPrice - product.salePrice) / product.regularPrice) * 100)
    : 0;

/**
 * Turns the shop page's query string into a Mongo filter. Kept separate so
 * the filter logic is readable and testable on its own.
 */
function buildShopFilter({ search, color, priceRange, categories, brands, sizes }, { activeCategories, activeBrands }) {
  const filter = {
    isBlocked: false,
    category: { $in: activeCategories.map((cat) => cat._id) },
    brand: { $in: activeBrands.map((brand) => brand.brandName) },
  };

  if (search) {
    // category is a ref, not a string — resolve name matches against the
    // already-fetched activeCategories list instead of a $lookup.
    const matchingCategoryIds = activeCategories
      .filter((cat) => cat.name && cat.name.toLowerCase().includes(search.toLowerCase()))
      .map((cat) => cat._id);

    filter.$or = [
      { productName: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { brand: { $regex: search, $options: "i" } },
      ...(matchingCategoryIds.length ? [{ category: { $in: matchingCategoryIds } }] : []),
    ];
  }

  if (color) {
    filter.variants = { $elemMatch: { color } };
  }

  if (priceRange) {
    const [minPrice, maxPrice] = priceRange.split("-").map(Number);
    filter.salePrice = { $gte: minPrice, $lte: maxPrice };
  }

  const selectedCategories = asArray(categories);
  if (selectedCategories.length > 0) filter.category = { $in: selectedCategories };

  const selectedBrands = asArray(brands);
  if (selectedBrands.length > 0) filter.brand = { $in: selectedBrands };

  // Overwrites the colour filter when both are present — the same single
  // `variants` key, which is how this has always behaved.
  const selectedSizes = asArray(sizes);
  if (selectedSizes.length > 0) filter.variants = { $elemMatch: { size: { $in: selectedSizes } } };

  return filter;
}

async function getShopPage({ userId, query = {} }) {
  const search = query.search || "";

  // Any active filter resets to page 1 — otherwise narrowing the results
  // while on page 5 lands the shopper on an empty page.
  const isFiltered = Boolean(
    search || query.color || query.priceRange || query.categories || query.brands || query.sizes
  );
  const page = isFiltered ? 1 : parseInt(query.page) || 1;
  const limit = PRODUCTS_PER_PAGE;

  const [activeCategories, activeBrands] = await Promise.all([
    Category.find({ isListed: true }),
    Brand.find({ isBlocked: false }),
  ]);

  const filter = buildShopFilter({ ...query, search }, { activeCategories, activeBrands });

  const [products, totalProducts, uniqueColors] = await Promise.all([
    Product.find(filter)
      .sort(SORT_OPTIONS[query.sort] || DEFAULT_SORT)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("category"),
    Product.countDocuments(filter),
    Product.distinct("color"),
  ]);

  const categoriesWithCounts = await Promise.all(
    activeCategories.map(async (category) => ({
      ...category._doc,
      productCount: await Product.countDocuments({ category: category._id, isBlocked: false }),
    }))
  );

  const pageData = {
    products: products.map((product) => ({
      ...product._doc,
      discountPercentage: discountPercent(product),
    })),
    categories: categoriesWithCounts,
    brands: activeBrands,
    uniqueColors,
    search,
    sort: query.sort,
    selectedColor: query.color,
    currentPage: page,
    totalPages: Math.ceil(totalProducts / limit),
    productsPerPage: limit,
    totalProducts,
  };

  if (!userId) return pageData;

  const userData = await User.findById(userId)
    .populate({ path: "cart", populate: { path: "items.productId", model: "Product" } })
    .populate({ path: "wishlist", populate: { path: "items.productId", model: "Product" } });

  // Deliberately NOT buildIsValidProduct here: this query populates
  // items.productId but NOT its nested category, so product.category is a
  // raw ObjectId rather than a document. The shared helper reads
  // product.category._id and would reject every item, zeroing the counts.
  const listedCategoryIds = activeCategories.map((cat) => cat._id.toString());
  const unblockedBrandNames = activeBrands.map((brand) => brand.brandName);
  const isValidProduct = (product) =>
    product &&
    !product.isBlocked &&
    listedCategoryIds.includes(product.category?.toString()) &&
    unblockedBrandNames.includes(product.brand);

  return {
    user: userData,
    ...pageData,
    ...computeCartWishlistCounts(userData, isValidProduct),
  };
}

async function getProductDetails({ userId, productId }) {
  const [listedCategories, unblockedBrands, product] = await Promise.all([
    Category.find({ isListed: true }),
    Brand.find({ isBlocked: false }),
    Product.findById(productId)
      .select({
        productName: 1,
        productImage: 1,
        description: 1,
        brand: 1,
        category: 1,
        regularPrice: 1,
        salePrice: 1,
        rating: 1,
        reviewsCount: 1,
        variants: 1,
        isBlocked: 1,
      })
      .lean()
      .exec(),
  ]);

  const isValidProduct = buildIsValidProduct(listedCategories, unblockedBrands);

  if (!product || !isValidProduct(product)) {
    throw notFound("Product not found or unavailable");
  }

  const variants = Array.isArray(product.variants) ? product.variants : [];

  const relatedProducts = await Product.find({
    brand: product.brand,
    _id: { $ne: productId },
    isBlocked: false,
  })
    .lean()
    .exec();

  const pageData = {
    product: {
      ...product,
      variants: variants.map((variant) => ({
        size: variant.size,
        color: variant.color,
        quantity: variant.quantity || 0,
      })),
      totalQuantity: variants.reduce((total, variant) => total + (variant.quantity || 0), 0),
      discountPercentage: discountPercent(product),
    },
    relatedProducts: relatedProducts
      .filter((related) => isValidProduct(related))
      .slice(0, RELATED_PRODUCTS_SHOWN),
  };

  if (!userId) return { ...pageData, cartCount: 0, wishlistCount: 0 };

  const { userData, cartCount, wishlistCount } = await loadStorefrontContext(userId);
  return { ...pageData, user: userData, cartCount, wishlistCount };
}

module.exports = {
  getShopPage,
  getProductDetails,
  buildShopFilter,
  PRODUCTS_PER_PAGE,
  SORT_OPTIONS,
};
