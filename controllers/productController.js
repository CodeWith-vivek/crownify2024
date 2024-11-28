const Product = require("../models/productSchema");
const Category = require("../models/categorySchema");
const Brand = require("../models/brandSchema");
const User = require("../models/userSchema");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const getProductAddPage = async (req, res) => {
  try {
    const category = await Category.find({ isListed: true });
    const brand = await Brand.find({ isBlocked: false });
    res.render("product-add", { cat: category, brand: brand });
  } catch (error) {
    res.redirect("/admin/pageerror");
  }
};

const addProducts = async (req, res) => {
  try {
    const products = req.body;


    const productExists = await Product.findOne({
      productName: products.productName,
    });
    if (productExists) {
      return res
        .status(400)
        .json("Product already exists, please try with another name");
    }

    const images = [];
    const uploadDir = path.join(__dirname, "../public/uploads/product-image");

    // Process uploaded files
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const originalImagePath = req.files[i].path;
        const resizedImagePath = path.join(uploadDir, req.files[i].filename);

        await sharp(originalImagePath)
          .resize({ width: 440, height: 440, fit: "cover" })
          .toFile(resizedImagePath);

        images.push(req.files[i].filename);
        fs.unlinkSync(originalImagePath);
      }
    }

    // Validate category
    const category = await Category.findOne({ name: products.category });
    if (!category) {
      return res.status(400).json("Invalid category name");
    }

    const variants = [];

    // Check if colors, sizes, and quantities are arrays
    if (
      Array.isArray(products.colors) &&
      Array.isArray(products.sizes) &&
      Array.isArray(products.quantities)
    ) {
      products.colors.forEach((color, index) => {
        variants.push({
          color: color,
          size: products.sizes[index] || null,
          quantity: Number(products.quantities[index]) || 1, // Convert to number
        });
      });
    } else {
      // Single variant case, if not sent as arrays
      variants.push({
        color: products.colors || "Default",
        size: products.sizes || "ONESIZE",
        quantity: Number(products.quantities) || 1, // Convert to number
      });
    }

    const newProduct = new Product({
      productName: products.productName,
      description: products.description,
      brand: products.brand,
      category: category._id,
      regularPrice: Number(products.regularPrice), // Convert to number
      salePrice: Number(products.salePrice), // Convert to number
      productImage: images,
      createdOn: new Date(),
      status: "Available",
      variants: variants, // Add the variants array
    });

    await newProduct.save();
    return res.redirect("/admin/addProducts");
  } catch (error) {
    console.error("Error saving product:", error);
    return res.redirect("/admin/pageerror");
  }
};

const getAllProducts = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 6;

    // Fetch products with search, pagination, and category population
    const productData = await Product.find({
      $or: [
        { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
        { brand: { $regex: new RegExp(".*" + search + ".*", "i") } },
      ],
    })
      .limit(limit)
      .skip((page - 1) * limit)
      .populate("category")
      .lean(); // Use lean() to improve performance

    // Calculate total quantity for each product
    productData.forEach((product) => {
      product.totalQuantity = product.variants
        ? product.variants.reduce(
            (sum, variant) => sum + (variant.quantity || 0),
            0
          )
        : 0; // Default to 0 if variants is undefined
    });

    // Fetch additional data for filters
    const count = await Product.countDocuments({
      $or: [
        { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
        { brand: { $regex: new RegExp(".*" + search + ".*", "i") } },
      ],
    });

    const category = await Category.find({ isListed: true });
    const brand = await Brand.find({ isBlocked: false });

    if (category && brand) {
      res.render("products", {
        data: productData, // Send enhanced product data
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        cat: category,
        brand: brand,
      });
    } else {
      res.render("page-404");
    }
  } catch (error) {
    res.redirect("/admin/pageerror");
  }
};

const addProductOffer = async (req, res) => {
  try {
    const { productId, percentage } = req.body;

    const findProduct = await Product.findOne({ _id: productId });
    const findCategory = await Category.findOne({ _id: findProduct.category });
    if (findCategory.categoryOffer > percentage) {
      return res.json({
        status: false,
        message: "This product's category already has a category offer",
      });
    }
    findProduct.salePrice =
      findProduct.salePrice -
      Math.floor(findProduct.regularPrice * (percentage / 100));
    findProduct.productOffer = parseInt(percentage);
    await findProduct.save();
    findCategory.categoryOffer = 0;
    await findCategory.save();
    res.json({ status: true });
  } catch (error) {
    res.status(500).json({ status: false, message: "Internal server error" });
    res.redirect("/admin/pageerror");
  }
};

const removeProductOffer = async (req, res) => {
  try {
    const { productId } = req.body;
    const findProduct = await Product.findOne({ _id: productId });
    const percentage = findProduct.productOffer;
    findProduct.salePrice =
      findProduct.salePrice +
      Math.floor(findProduct.regularPrice * (percentage / 100));
    findProduct.productOffer = 0;
    await findProduct.save();
    res.json({ status: true });
  } catch (error) {
    res.redirect("/admin/pageerror");
  }
};

const blockProduct = async (req, res) => {
  try {
    let id = req.query.id;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: true } });
    res.redirect("/admin/products");
  } catch (error) {
    res.redirect("/admin/pageerror");
  }
};

const unblockProduct = async (req, res) => {
  try {
    let id = req.query.id;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: false } });
    res.redirect("/admin/products");
  } catch (error) {
    res.redirect("/admin/pageerror");
  }
};

const getEditProduct = async (req, res) => {
  try {
    const id = req.query.id;
    const product = await Product.findOne({ _id: id });
    const category = await Category.find({});
    const brand = await Brand.find({});
    res.render("edit-product", {
      product: product,
      cat: category,
      brand: brand,
    });
  } catch (error) {
    res.redirect("/admin/pageerror");
  }
};

const editProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const updates = req.body;
 
    // Find the product to update
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json("Product not found");
    }

    // Update product details
    product.productName = updates.productName || product.productName;
    product.description = updates.description || product.description;
    product.brand = updates.brand || product.brand;

    // Validate and update category
    if (updates.category) {
      const category = await Category.findOne({ name: updates.category });
      if (!category) {
        return res.status(400).json("Invalid category name");
      }
      product.category = category._id;
    }

    product.regularPrice = Number(updates.regularPrice) || product.regularPrice;
    product.salePrice = Number(updates.salePrice) || product.salePrice;

    // Process uploaded files for images
    const images = product.productImage || [];
    const uploadDir = path.join(__dirname, "../public/uploads/product-image");

    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const originalImagePath = req.files[i].path;
        const resizedImagePath = path.join(uploadDir, req.files[i].filename);

        await sharp(originalImagePath)
          .resize({ width: 440, height: 440, fit: "cover" })
          .toFile(resizedImagePath);

        images.push(req.files[i].filename);
        fs.unlinkSync(originalImagePath);
      }
      product.productImage = images; // Update images
    }

    // Update variants
    const variants = [];

    if (
      Array.isArray(updates.colors) &&
      Array.isArray(updates.sizes) &&
      Array.isArray(updates.quantities)
    ) {
      updates.colors.forEach((color, index) => {
        variants.push({
          color: color,
          size: updates.sizes[index] || null,
          quantity: Number(updates.quantities[index]) || 1,
        });
      });
    } else {
      variants.push({
        color: updates.colors || "Default",
        size: updates.sizes || "ONESIZE",
        quantity: Number(updates.quantities) || 1,
      });
    }

    product.variants = variants;

    await product.save();
    return res.redirect("/admin/products"); // Redirect to products listing
  } catch (error) {
    console.error("Error updating product:", error);
    return res.redirect("/admin/pageerror");
  }
};

const deleteSingleImage = async (req, res) => {
  try {
    const { imageNameToServer, productIdToServer } = req.body;
    const product = await Product.findByIdAndUpdate(productIdToServer, {
      $pull: { productImage: imageNameToServer },
    });
    const imagePath = path.join(
      "public",
      "uploads",
      "re-image",
      imageNameToServer
    );
    if (fs.existsSync(imagePath)) {
      await fs.unlinkSync(imagePath);
      console.log(`Image ${imageNameToServer} deleted successfully`);
    } else {
      console.log(`Image ${imageNameToServer} not found`);
    }
    res.send({ status: true });
  } catch (error) {
    res.redirect("/admin/pageerror");
  }
};

module.exports = {
  getProductAddPage,
  addProducts,
  getAllProducts,
  addProductOffer,
  removeProductOffer,
  blockProduct,
  unblockProduct,
  getEditProduct,
  editProduct,
  deleteSingleImage,
};
