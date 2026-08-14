const Product = require("./productSchema");
const Category = require("../category/categorySchema");
const Brand = require("../brand/brandSchema");
const { destroyByUrl } = require("../../shared/utils/cloudinaryUpload");
const { uploadProductImages, buildVariants, MAX_PRODUCT_IMAGES } = require("./helpers/productMedia");
const { notFound, badRequest } = require("../../shared/errors/AppError");

// Admin product rules, free of Express. Multer's parsed `files` array is
// passed in as plain data — the service never sees req or res.

const MAX_OFFER_PERCENTAGE = 80;
const PRODUCTS_PER_PAGE = 6;

/**
 * A category-wide offer wins over whatever sale price was typed in, so a
 * newly added or recategorised product can't undercut or ignore the
 * running promo.
 */
function priceUnderCategoryOffer(regularPrice, categoryOffer) {
  const discount = Math.floor((regularPrice * categoryOffer) / 100);
  return Math.max(regularPrice - discount, 0);
}

async function createProduct({ body, files }) {
  const productExists = await Product.findOne({
    productName: new RegExp(`^${body.productName}$`, "i"),
  });

  if (productExists) {
    throw badRequest("Product already exists, please try with another name");
  }

  const images = await uploadProductImages(files);

  const category = await Category.findOne({ name: body.category });
  if (!category) throw badRequest("Invalid category name");

  const regularPrice = Number(body.regularPrice);
  const salePrice =
    category.categoryOffer > 0
      ? priceUnderCategoryOffer(regularPrice, category.categoryOffer)
      : Number(body.salePrice);

  await new Product({
    productName: body.productName,
    description: body.description,
    brand: body.brand,
    category: category._id,
    regularPrice,
    salePrice,
    productImage: images,
    createdOn: new Date(),
    status: "Available",
    variants: buildVariants(body),
  }).save();

  return { message: "Product added successfully" };
}

async function updateProduct({ productId, updates, files }) {
  if (!updates.productName) throw badRequest("Product name is required.");

  const regularPrice = Math.floor(Number(updates.regularPrice));
  if (isNaN(regularPrice) || regularPrice < 0) {
    throw badRequest("Regular price must be a valid positive number.");
  }

  const salePrice = Math.floor(Number(updates.salePrice));
  if (isNaN(salePrice) || salePrice < 0) {
    throw badRequest("Sale price must be a valid positive number.");
  }

  const product = await Product.findById(productId);
  if (!product) throw notFound("Product not found");

  product.productName = updates.productName || product.productName;
  product.description = updates.description || product.description;
  product.brand = updates.brand || product.brand;

  if (updates.category) {
    const category = await Category.findById(updates.category);
    if (!category) throw badRequest("Invalid category name");

    product.category = category._id;
    product.salePrice =
      category.categoryOffer >= 0
        ? priceUnderCategoryOffer(regularPrice, category.categoryOffer)
        : salePrice;
  }

  product.regularPrice = regularPrice;
  if (!updates.category || !product.salePrice) {
    product.salePrice = salePrice;
  }

  if (files && files.length > 0) {
    const images = product.productImage || [];

    if (images.length + files.length > MAX_PRODUCT_IMAGES) {
      throw badRequest(
        `You cannot upload more than ${MAX_PRODUCT_IMAGES} images. You need to delete previous images to add more.`
      );
    }

    product.productImage = [...images, ...(await uploadProductImages(files))];
  }

  try {
    product.variants = buildVariants(updates, { requireEqualLengths: true });
  } catch (variantError) {
    // buildVariants predates AppError and throws a plain Error; its message
    // is already user-facing, so re-wrap rather than let it become a 500.
    throw badRequest(variantError.message);
  }

  await product.save();
  return { message: "Product updated successfully" };
}

async function removeProductImage({ productId, imageUrl }) {
  await Product.findByIdAndUpdate(productId, { $pull: { productImage: imageUrl } });
  // No-ops for pre-Cloudinary images (bare local filenames rather than
  // Cloudinary URLs) — those were never findable by public_id anyway.
  await destroyByUrl(imageUrl);
}

/**
 * Applying an offer can be refused for reasons the admin should read, so
 * a refusal resolves with `status: false` rather than throwing — the
 * admin UI renders `message` and only falls back to a generic error on a
 * genuine failure.
 */
async function applyProductOffer({ productId, percentage }) {
  if (percentage > MAX_OFFER_PERCENTAGE) {
    return {
      status: false,
      message: `The maximum product offer cannot exceed ${MAX_OFFER_PERCENTAGE}%`,
    };
  }

  const product = await Product.findById(productId);
  if (!product) throw notFound("Product not found");

  const category = await Category.findById(product.category);
  if (!category) throw notFound("Product category not found");

  // A product-level offer only makes sense if it beats the category-wide
  // one already running — otherwise it would silently raise the price.
  if (category.categoryOffer >= percentage) {
    return {
      status: false,
      message: "This product's category already has a higher or equal category offer",
    };
  }

  if (
    product.productOffer !== 0 &&
    category.categoryOffer !== 0 &&
    product.productOffer === category.categoryOffer
  ) {
    return {
      status: false,
      message: "The product offer cannot be the same as the category offer",
    };
  }

  const discountAmount = Math.floor(product.regularPrice * (percentage / 100));
  product.salePrice = product.regularPrice - discountAmount;
  product.productOffer = parseInt(percentage);
  await product.save();

  // Once every product in the category carries its own offer, the
  // category-wide offer is no longer applying to anything — clear it so
  // the admin UI doesn't show a promo that affects zero products.
  if (category.categoryOffer > 0) {
    const stillOnCategoryOffer = await Product.countDocuments({
      category: category._id,
      productOffer: 0,
    });

    if (stillOnCategoryOffer === 0) {
      category.categoryOffer = 0;
      await category.save();
    }
  }

  return { status: true, message: "Product offer applied successfully" };
}

async function clearProductOffer({ productId }) {
  const product = await Product.findById(productId);
  // Checked before the category lookup: reading product.category off a
  // missing product threw a TypeError, surfacing as a 500 instead of a 404.
  if (!product) throw notFound("Product not found");

  const category = await Category.findById(product.category);

  product.productOffer = 0;

  // Dropping the product's own offer doesn't make it full price if the
  // category still has one running — it falls back to that.
  product.salePrice =
    category && category.categoryOffer > 0
      ? priceUnderCategoryOffer(product.regularPrice, category.categoryOffer)
      : product.regularPrice;

  await product.save();
  return { status: true, message: "Product offer removed successfully" };
}

async function setProductBlocked({ productId, isBlocked }) {
  await Product.updateOne({ _id: productId }, { $set: { isBlocked } });
  return { message: isBlocked ? "Product blocked" : "Product unblocked" };
}

async function getAddFormOptions() {
  const [cat, brand] = await Promise.all([
    Category.find({ isListed: true }),
    Brand.find({ isBlocked: false }),
  ]);
  return { cat, brand };
}

async function listProducts({ search = "", page = 1 }) {
  const limit = PRODUCTS_PER_PAGE;
  const searchFilter = {
    $or: [
      { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
      { brand: { $regex: new RegExp(".*" + search + ".*", "i") } },
    ],
  };

  const [data, count, cat, brand] = await Promise.all([
    Product.find(searchFilter)
      .limit(limit)
      .skip((page - 1) * limit)
      .populate("category")
      .lean(),
    Product.countDocuments(searchFilter),
    Category.find({ isListed: true }),
    Brand.find({ isBlocked: false }),
  ]);

  // Stock is per-variant; the list shows one combined figure per product.
  data.forEach((product) => {
    product.totalQuantity = (product.variants || []).reduce(
      (sum, variant) => sum + (variant.quantity || 0),
      0
    );
  });

  return { data, currentPage: page, totalPages: Math.ceil(count / limit), cat, brand };
}

async function getEditFormData(productId) {
  const [product, cat, brand] = await Promise.all([
    Product.findById(productId),
    // Unfiltered on purpose: an existing product may reference a category
    // or brand that has since been unlisted/blocked, and the edit form
    // still has to render its current value in the dropdown.
    Category.find({}),
    Brand.find({}),
  ]);
  return { product, cat, brand };
}

module.exports = {
  createProduct,
  updateProduct,
  removeProductImage,
  applyProductOffer,
  clearProductOffer,
  setProductBlocked,
  getAddFormOptions,
  listProducts,
  getEditFormData,
  MAX_OFFER_PERCENTAGE,
  PRODUCTS_PER_PAGE,
};
