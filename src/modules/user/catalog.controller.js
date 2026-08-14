const Product = require("../product/productSchema");
const Category = require("../category/categorySchema");
const Brand = require("../brand/brandSchema");
const User = require("./userSchema");
const { buildIsValidProduct, computeCartWishlistCounts } = require("../../shared/utils/catalogVisibility");
const { loadStorefrontContext } = require("../../shared/utils/storefrontContext");

// Product browsing: the filterable/sortable shop listing, and the single
// product detail page.

const loadShopPage = async (req, res) => {
  try {
    const userId = req.session.user;

    const search = req.query.search || "";
    const limit = 12;

    const parseArrayParam = (param) =>
      req.query[param]
        ? Array.isArray(req.query[param])
          ? req.query[param]
          : [req.query[param]]
        : [];

    // Any active filter resets to page 1 — otherwise narrowing the results
    // while on page 5 lands the shopper on an empty page.
    const isFiltered =
      search ||
      req.query.color ||
      req.query.priceRange ||
      req.query.categories ||
      req.query.brands ||
      req.query.sizes;

    const page = isFiltered ? 1 : parseInt(req.query.page) || 1;

    const sortOptions = {
      priceLowHigh: { salePrice: 1 },
      priceHighLow: { salePrice: -1 },
      alphaAsc: { productName: 1 },
      alphaDesc: { productName: -1 },
      newArrivals: { createdAt: -1 },
      popularity: { popularity: -1 },
    };
    const sortCriteria = sortOptions[req.query.sort] || { createdAt: -1 };

    const [activeCategories, activeBrands] = await Promise.all([
      Category.find({ isListed: true }),
      Brand.find({ isBlocked: false }),
    ]);

    const productsQuery = {
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

      productsQuery.$or = [
        { productName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { brand: { $regex: search, $options: "i" } },
        ...(matchingCategoryIds.length ? [{ category: { $in: matchingCategoryIds } }] : []),
      ];
    }

    if (req.query.color) {
      productsQuery.variants = { $elemMatch: { color: req.query.color } };
    }

    if (req.query.priceRange) {
      const [minPrice, maxPrice] = req.query.priceRange.split("-").map(Number);
      productsQuery.salePrice = { $gte: minPrice, $lte: maxPrice };
    }

    const selectedCategories = parseArrayParam("categories");
    if (selectedCategories.length > 0) {
      productsQuery.category = { $in: selectedCategories };
    }

    const selectedBrands = parseArrayParam("brands");
    if (selectedBrands.length > 0) {
      productsQuery.brand = { $in: selectedBrands };
    }

    const selectedSizes = parseArrayParam("sizes");
    if (selectedSizes.length > 0) {
      productsQuery.variants = { $elemMatch: { size: { $in: selectedSizes } } };
    }

    const [products, totalProducts, uniqueColors] = await Promise.all([
      Product.find(productsQuery)
        .sort(sortCriteria)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("category"),
      Product.countDocuments(productsQuery),
      Product.distinct("color"),
    ]);

    const productsWithDiscount = products.map((product) => {
      const discount =
        product.regularPrice > 0
          ? ((product.regularPrice - product.salePrice) / product.regularPrice) * 100
          : 0;
      return {
        ...product._doc,
        discountPercentage: Math.round(discount),
      };
    });

    const categoriesWithCounts = await Promise.all(
      activeCategories.map(async (category) => {
        const productCount = await Product.countDocuments({
          category: category._id,
          isBlocked: false,
        });
        return {
          ...category._doc,
          productCount,
        };
      })
    );

    const renderData = {
      products: productsWithDiscount,
      categories: categoriesWithCounts,
      brands: activeBrands,
      uniqueColors,
      search,
      sort: req.query.sort,
      selectedColor: req.query.color,
      currentPage: page,
      totalPages: Math.ceil(totalProducts / limit),
      productsPerPage: limit,
      totalProducts,
    };

    if (!userId) {
      return res.json({ success: true, ...renderData });
    }

    const userData = await User.findById(userId)
      .populate({ path: "cart", populate: { path: "items.productId", model: "Product" } })
      .populate({ path: "wishlist", populate: { path: "items.productId", model: "Product" } });

    // Deliberately NOT buildIsValidProduct here: this query populates
    // items.productId but NOT its nested category, so product.category is a
    // raw ObjectId rather than a document. The shared helper reads
    // product.category._id and would reject every item, zeroing the counts.
    const isValidProduct = (product) =>
      product &&
      !product.isBlocked &&
      activeCategories.map((cat) => cat._id.toString()).includes(product.category?.toString()) &&
      activeBrands.map((brand) => brand.brandName).includes(product.brand);

    const { cartCount, wishlistCount } = computeCartWishlistCounts(userData, isValidProduct);

    return res.json({
      success: true,
      user: userData,
      ...renderData,
      cartCount,
      wishlistCount,
    });
  } catch (error) {
    console.error("Error in loadShopPage:", error.message, error.stack);
    return res.status(500).json({
      success: false,
      message: "An error occurred while loading the shop page",
    });
  }
};

const loadProductDetails = async (req, res) => {
  try {
    const productId = req.params.id;
    const userId = req.session.user;

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
      return res.status(404).json({ success: false, message: "Product not found or unavailable" });
    }

    const discount =
      product.regularPrice > 0
        ? Math.floor(((product.regularPrice - product.salePrice) / product.regularPrice) * 100)
        : 0;
    product.discountPercentage = discount;

    product.variants = Array.isArray(product.variants) ? product.variants : [];

    const totalQuantity = product.variants.reduce(
      (total, variant) => total + (variant.quantity || 0),
      0
    );

    const relatedProducts = await Product.find({
      brand: product.brand,
      _id: { $ne: productId },
      isBlocked: false,
    })
      .lean()
      .exec();

    const filteredRelatedProducts = relatedProducts.filter((relProduct) =>
      isValidProduct(relProduct)
    );

    const templateData = {
      product: {
        ...product,
        variants: product.variants.map((variant) => ({
          size: variant.size,
          color: variant.color,
          quantity: variant.quantity || 0,
        })),
        totalQuantity,
        discountPercentage: Math.round(discount),
      },
      relatedProducts: filteredRelatedProducts.slice(0, 4),
    };

    if (userId) {
      const { userData, cartCount, wishlistCount } = await loadStorefrontContext(userId);
      templateData.user = userData;
      templateData.cartCount = cartCount;
      templateData.wishlistCount = wishlistCount;
    } else {
      templateData.cartCount = 0;
      templateData.wishlistCount = 0;
    }

    return res.json({ success: true, ...templateData });
  } catch (error) {
    console.error("Error loading product details:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { loadShopPage, loadProductDetails };
