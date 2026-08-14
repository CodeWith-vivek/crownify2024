const Product = require("./productSchema");
const Category = require("../category/categorySchema");

// Admin actions applied to products that already exist: per-product
// discount offers, and storefront visibility.

const MAX_OFFER_PERCENTAGE = 80;

const addProductOffer = async (req, res) => {
  try {
    const { productId, percentage } = req.body;

    if (percentage > MAX_OFFER_PERCENTAGE) {
      return res.json({
        status: false,
        message: `The maximum product offer cannot exceed ${MAX_OFFER_PERCENTAGE}%`,
      });
    }

    const findProduct = await Product.findOne({ _id: productId });
    const findCategory = await Category.findOne({ _id: findProduct.category });

    // A product-level offer only makes sense if it beats the category-wide
    // one already running — otherwise it would silently raise the price.
    if (findCategory.categoryOffer >= percentage) {
      return res.json({
        status: false,
        message: "This product's category already has a higher or equal category offer",
      });
    }

    if (
      findProduct.productOffer !== 0 &&
      findCategory.categoryOffer !== 0 &&
      findProduct.productOffer === findCategory.categoryOffer
    ) {
      return res.json({
        status: false,
        message: "The product offer cannot be the same as the category offer",
      });
    }

    const discountAmount = Math.floor(findProduct.regularPrice * (percentage / 100));
    findProduct.salePrice = findProduct.regularPrice - discountAmount;
    findProduct.productOffer = parseInt(percentage);

    await findProduct.save();

    // Once every product in the category carries its own offer, the
    // category-wide offer is no longer applying to anything — clear it so
    // the admin UI doesn't show a promo that affects zero products.
    if (findCategory.categoryOffer > 0) {
      const categoryAffectedProducts = await Product.find({
        category: findCategory._id,
        productOffer: 0,
      });

      if (categoryAffectedProducts.length === 0) {
        findCategory.categoryOffer = 0;
        await findCategory.save();
      }
    }

    res.json({ status: true, message: "Product offer applied successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

const removeProductOffer = async (req, res) => {
  try {
    const { productId } = req.body;

    const findProduct = await Product.findOne({ _id: productId });
    const findCategory = await Category.findOne({ _id: findProduct.category });

    if (!findProduct) {
      return res.status(404).json({ status: false, message: "Product not found" });
    }

    const productOfferPercentage = findProduct.productOffer;

    findProduct.salePrice =
      findProduct.salePrice +
      Math.floor(findProduct.regularPrice * (productOfferPercentage / 100));
    findProduct.productOffer = 0;

    // Removing the product's own offer doesn't make it full price if the
    // category still has one running — it falls back to that.
    if (findCategory && findCategory.categoryOffer > 0) {
      const categoryDiscount = Math.floor(
        findProduct.regularPrice * (findCategory.categoryOffer / 100)
      );
      findProduct.salePrice = findProduct.regularPrice - categoryDiscount;
    } else {
      findProduct.salePrice = findProduct.regularPrice;
    }

    await findProduct.save();

    res.json({ status: true, message: "Product offer removed successfully" });
  } catch (error) {
    console.error("Error removing product offer:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

const blockProduct = async (req, res) => {
  try {
    await Product.updateOne({ _id: req.query.id }, { $set: { isBlocked: true } });
    res.json({ success: true, message: "Product blocked" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Could not block product" });
  }
};

const unblockProduct = async (req, res) => {
  try {
    await Product.updateOne({ _id: req.query.id }, { $set: { isBlocked: false } });
    res.json({ success: true, message: "Product unblocked" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Could not unblock product" });
  }
};

module.exports = { addProductOffer, removeProductOffer, blockProduct, unblockProduct };
