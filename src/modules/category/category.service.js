const Category = require("./categorySchema");
const Product = require("../product/productSchema");
const { notFound, badRequest, AppError } = require("../../shared/errors/AppError");

// Category rules, free of Express.

const CATEGORIES_PER_PAGE = 6;
const MAX_OFFER_PERCENTAGE = 80;

// Names are stored uppercase and compared case-insensitively, so "Caps"
// and "CAPS" can never both exist.
const normalizeName = (name) => name.trim().toUpperCase();
const sameNameAs = (name) => ({ name: { $regex: new RegExp(`^${normalizeName(name)}$`, "i") } });

const priceAfterOffer = (regularPrice, percentage) =>
  Math.floor(regularPrice - (regularPrice * percentage) / 100);

async function listCategories({ page = 1, limit = CATEGORIES_PER_PAGE } = {}) {
  const [cat, totalCategories] = await Promise.all([
    Category.find({})
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Category.countDocuments(),
  ]);

  return { cat, currentPage: page, totalPages: Math.ceil(totalCategories / limit), totalCategories };
}

async function createCategory({ name, description }) {
  if (!name || !description) throw badRequest("Name and description are required.");

  if (await Category.findOne(sameNameAs(name))) {
    throw new AppError("Category already exists.", { status: 409 });
  }

  await new Category({ name: normalizeName(name), description }).save();

  return { message: "Category added successfully." };
}

async function getCategory(categoryId) {
  const category = await Category.findById(categoryId);
  if (!category) throw notFound("Category not found");
  return category;
}

async function updateCategory({ categoryId, name, description }) {
  if (!name) throw badRequest("Category name is required.");

  // Matched case-insensitively, like creation does. A case-sensitive
  // check let an edit introduce "Caps" alongside an existing "CAPS".
  const clash = await Category.findOne(sameNameAs(name));
  if (clash && clash._id.toString() !== categoryId) {
    throw badRequest("Category exists, please choose another name");
  }

  const category = await Category.findByIdAndUpdate(
    categoryId,
    { name: normalizeName(name), description },
    { new: true }
  );

  if (!category) throw notFound("Category not found");

  return { message: "Category updated successfully", category };
}

async function setCategoryListed({ categoryId, isListed }) {
  await Category.updateOne({ _id: categoryId }, { $set: { isListed } });
  return { message: isListed ? "Category listed" : "Category unlisted" };
}

/**
 * Applies a category-wide offer to every product that doesn't already
 * carry a better one of its own.
 *
 * A product with a higher personal offer keeps it; its offer is only
 * parked (in previousProductOffer) when the category one is at least as
 * good, so removing the category offer can restore it later.
 *
 * A refusal resolves with `status: false` rather than throwing — the admin
 * UI renders `message` and only falls back to a generic error on a real
 * failure.
 */
async function applyCategoryOffer({ categoryId, percentage: rawPercentage }) {
  const percentage = parseInt(rawPercentage);

  if (percentage > MAX_OFFER_PERCENTAGE) {
    return {
      status: false,
      message: `The maximum category offer cannot exceed ${MAX_OFFER_PERCENTAGE}%`,
    };
  }

  const category = await Category.findById(categoryId);
  if (!category) throw notFound("Category not found");

  const products = await Product.find({ category: category._id });
  const productsToUpdate = products.filter((product) => product.productOffer <= percentage);
  const hasHigherProductOffer = products.some((product) => product.productOffer > percentage);

  if (productsToUpdate.length === 0 && hasHigherProductOffer) {
    return {
      status: false,
      message: "Products within this category already have a higher product offer",
    };
  }

  await Category.updateOne({ _id: categoryId }, { $set: { categoryOffer: percentage } });

  for (const product of productsToUpdate) {
    if (product.productOffer > 0) {
      product.previousProductOffer = product.productOffer;
      product.productOffer = 0;
    }

    product.salePrice = priceAfterOffer(product.regularPrice, percentage);
    await product.save();
  }

  return {
    status: true,
    message:
      "Category offer applied successfully to products with no existing or lower offers!",
  };
}

/** Restores each product's own parked offer, or full price if it had none. */
async function clearCategoryOffer({ categoryId }) {
  if (!categoryId) throw badRequest("Category ID is required");

  const category = await Category.findById(categoryId);
  if (!category) throw notFound("Category not found");

  const products = await Product.find({ category: category._id });

  await Promise.all(
    products.map((product) => {
      if (product.previousProductOffer) {
        product.productOffer = product.previousProductOffer;
        // Floored like every other price write — this one alone left
        // fractional sale prices behind.
        product.salePrice = priceAfterOffer(
          product.regularPrice,
          product.previousProductOffer
        );
        product.previousProductOffer = undefined;
      } else {
        product.salePrice = product.regularPrice;
      }

      return product.save();
    })
  );

  category.categoryOffer = 0;
  await category.save();

  return { status: true, message: "Category offer removed successfully!" };
}

module.exports = {
  listCategories,
  createCategory,
  getCategory,
  updateCategory,
  setCategoryListed,
  applyCategoryOffer,
  clearCategoryOffer,
  CATEGORIES_PER_PAGE,
  MAX_OFFER_PERCENTAGE,
};
