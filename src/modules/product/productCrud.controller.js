const Product = require("./productSchema");
const Category = require("../category/categorySchema");
const { destroyByUrl } = require("../../shared/utils/cloudinaryUpload");
const { uploadProductImages, buildVariants, MAX_PRODUCT_IMAGES } = require("./helpers/productMedia");

// Admin-side write endpoints: create, update, and per-image deletion.

const addProducts = async (req, res) => {
  try {
    const products = req.body;

    const productExists = await Product.findOne({
      productName: new RegExp(`^${products.productName}$`, "i"),
    });

    if (productExists) {
      return res.status(400).json({
        success: false,
        message: "Product already exists, please try with another name",
      });
    }

    const images = await uploadProductImages(req.files);

    const category = await Category.findOne({ name: products.category });
    if (!category) {
      return res.status(400).json({ success: false, message: "Invalid category name" });
    }

    let salePrice = Number(products.salePrice);
    const regularPrice = Number(products.regularPrice);

    // A live category-wide offer overrides whatever sale price was typed
    // in, so the new product doesn't undercut or ignore the running promo.
    if (category.categoryOffer > 0) {
      const discount = (regularPrice * category.categoryOffer) / 100;
      salePrice = Math.max(regularPrice - discount, 0);
    }

    const newProduct = new Product({
      productName: products.productName,
      description: products.description,
      brand: products.brand,
      category: category._id,
      regularPrice: regularPrice,
      salePrice: salePrice,
      productImage: images,
      createdOn: new Date(),
      status: "Available",
      variants: buildVariants(products),
    });

    await newProduct.save();
    return res.json({ success: true, message: "Product added successfully" });
  } catch (error) {
    console.error("Error saving product:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while saving the product",
    });
  }
};

const editProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const updates = req.body;

    if (!updates.productName) {
      return res
        .status(400)
        .json({ success: false, message: "Product name is required." });
    }

    const regularPrice = Math.floor(Number(updates.regularPrice));
    if (isNaN(regularPrice) || regularPrice < 0) {
      return res.status(400).json({
        success: false,
        message: "Regular price must be a valid positive number.",
      });
    }

    const salePrice = Math.floor(Number(updates.salePrice));
    if (isNaN(salePrice) || salePrice < 0) {
      return res.status(400).json({
        success: false,
        message: "Sale price must be a valid positive number.",
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    product.productName = updates.productName || product.productName;
    product.description = updates.description || product.description;
    product.brand = updates.brand || product.brand;

    if (updates.category) {
      const category = await Category.findById(updates.category);
      if (!category) {
        return res.status(400).json({ success: false, message: "Invalid category name" });
      }

      product.category = category._id;

      if (category.categoryOffer >= 0) {
        const discount = Math.floor((regularPrice * category.categoryOffer) / 100);
        product.salePrice = Math.max(regularPrice - discount, 0);
      } else {
        product.salePrice = salePrice;
      }
    }

    product.regularPrice = regularPrice;
    if (!updates.category || !product.salePrice) {
      product.salePrice = salePrice;
    }

    if (req.files && req.files.length > 0) {
      const images = product.productImage || [];

      if (images.length + req.files.length > MAX_PRODUCT_IMAGES) {
        return res.status(400).json({
          success: false,
          message: `You cannot upload more than ${MAX_PRODUCT_IMAGES} images. You need to delete previous images to add more.`,
        });
      }

      const newUrls = await uploadProductImages(req.files);
      product.productImage = [...images, ...newUrls];
    }

    try {
      product.variants = buildVariants(updates, { requireEqualLengths: true });
    } catch (variantError) {
      return res.status(400).json({ success: false, message: variantError.message });
    }

    await product.save();
    return res.json({ success: true, message: "Product updated successfully" });
  } catch (error) {
    console.error("Error updating product:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while updating the product",
    });
  }
};

const deleteSingleImage = async (req, res) => {
  try {
    const { imageNameToServer, productIdToServer } = req.body;
    await Product.findByIdAndUpdate(productIdToServer, {
      $pull: { productImage: imageNameToServer },
    });
    // No-ops for pre-Cloudinary images (bare local filenames rather than
    // Cloudinary URLs) — those were never findable by public_id anyway.
    await destroyByUrl(imageNameToServer);
    res.json({ status: true, success: true });
  } catch (error) {
    res.status(500).json({ status: false, success: false, message: "Could not delete image" });
  }
};

module.exports = { addProducts, editProduct, deleteSingleImage };
