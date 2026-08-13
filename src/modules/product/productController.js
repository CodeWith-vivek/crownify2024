const Product = require("./productSchema");
const Category = require("../category/categorySchema");
const Brand = require("../brand/brandSchema");
const User = require("../user/userSchema");
const sharp = require("sharp");
const { uploadBufferToCloudinary, destroyByUrl } = require("../../shared/utils/cloudinaryUpload");

//code to load product add page

const getProductAddPage = async (req, res) => {
  try {
    const category = await Category.find({ isListed: true });
    const brand = await Brand.find({ isBlocked: false });
    res.json({ success: true, cat: category, brand: brand });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error loading page" });
  }
};

//code to add products

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

    const images = [];

    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const resizedBuffer = await sharp(req.files[i].buffer)
          .resize({ width: 440, height: 440, fit: "cover" })
          .toBuffer();

        const result = await uploadBufferToCloudinary(resizedBuffer, "crownify/products");
        images.push(result.secure_url);
      }
    }

    const category = await Category.findOne({ name: products.category });
    if (!category) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid category name" });
    }

    let salePrice = Number(products.salePrice);
    const regularPrice = Number(products.regularPrice);

    if (category.categoryOffer > 0) {
      const discount = (regularPrice * category.categoryOffer) / 100;
      salePrice = Math.max(regularPrice - discount, 0); 
    }

    const variants = [];

    if (
      Array.isArray(products.colors) &&
      Array.isArray(products.sizes) &&
      Array.isArray(products.quantities)
    ) {
      products.colors.forEach((color, index) => {
        variants.push({
          color: color,
          size: products.sizes[index] || null,
          quantity: Number(products.quantities[index]) || 1,
        });
      });
    } else {
      variants.push({
        color: products.colors || "Default",
        size: products.sizes || "ONESIZE",
        quantity: Number(products.quantities) || 1,
      });
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
      variants: variants,
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

//code to load list of products page

const getAllProducts = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 6;

  
    const productData = await Product.find({
      $or: [
        { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
        { brand: { $regex: new RegExp(".*" + search + ".*", "i") } },
      ],
    })
      .limit(limit)
      .skip((page - 1) * limit)
      .populate("category")
      .lean(); 

   
    productData.forEach((product) => {
      product.totalQuantity = product.variants
        ? product.variants.reduce(
            (sum, variant) => sum + (variant.quantity || 0),
            0
          )
        : 0;
    });

  
    const count = await Product.countDocuments({
      $or: [
        { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
        { brand: { $regex: new RegExp(".*" + search + ".*", "i") } },
      ],
    });

    const category = await Category.find({ isListed: true });
    const brand = await Brand.find({ isBlocked: false });

    if (category && brand) {
      const productsPageData = {
        data: productData,
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        cat: category,
        brand: brand,
      };
      res.json({ success: true, ...productsPageData });
    } else {
      res.status(404).json({ success: false, message: "Not found" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: "Error loading products" });
  }
};

//code to add product offer

const addProductOffer = async (req, res) => {
  try {
    const { productId, percentage } = req.body;

    if (percentage > 80) {
      return res.json({
        status: false,
        message: "The maximum product offer cannot exceed 80%",
      });
    }

    const findProduct = await Product.findOne({ _id: productId });
    const findCategory = await Category.findOne({ _id: findProduct.category });

    if (findCategory.categoryOffer >= percentage) {
      return res.json({
        status: false,
        message:
          "This product's category already has a higher or equal category offer",
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

    const discountAmount = Math.floor(
      findProduct.regularPrice * (percentage / 100)
    );
    findProduct.salePrice = findProduct.regularPrice - discountAmount;
    findProduct.productOffer = parseInt(percentage);

    await findProduct.save();

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

//code to remove product offer

const removeProductOffer = async (req, res) => {
  try {
    const { productId } = req.body;

   
    const findProduct = await Product.findOne({ _id: productId });
    const findCategory = await Category.findOne({ _id: findProduct.category });

    if (!findProduct) {
      return res
        .status(404)
        .json({ status: false, message: "Product not found" });
    }

    
    const productOfferPercentage = findProduct.productOffer;

    findProduct.salePrice =
      findProduct.salePrice +
      Math.floor(findProduct.regularPrice * (productOfferPercentage / 100));
    findProduct.productOffer = 0;

    if (findCategory && findCategory.categoryOffer > 0) {
      const categoryOfferPercentage = findCategory.categoryOffer;
      const categoryDiscount = Math.floor(
        findProduct.regularPrice * (categoryOfferPercentage / 100)
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

//code to block the product

const blockProduct = async (req, res) => {
  try {
    let id = req.query.id;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: true } });
    res.json({ success: true, message: "Product blocked" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Could not block product" });
  }
};


//code to unblock the product

const unblockProduct = async (req, res) => {
  try {
    let id = req.query.id;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: false } });
    res.json({ success: true, message: "Product unblocked" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Could not unblock product" });
  }
};

//code to load edit product page

const getEditProduct = async (req, res) => {
  try {
    const id = req.query.id;
    const product = await Product.findOne({ _id: id });
    const category = await Category.find({});
    const brand = await Brand.find({});
    const editData = { product: product, cat: category, brand: brand };
    res.json({ success: true, ...editData });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error loading product" });
  }
};

//code to edit product in admin side



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
 
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    product.productName = updates.productName || product.productName;
    product.description = updates.description || product.description;
    product.brand = updates.brand || product.brand;

    if (updates.category) {
  
      const category = await Category.findById(updates.category);
      if (!category) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid category name" });
      }

      product.category = category._id;

      if (category.categoryOffer >= 0) {
        const discount = Math.floor(
          (regularPrice * category.categoryOffer) / 100
        );
        product.salePrice = Math.max(regularPrice - discount, 0);
      } else {
        product.salePrice = salePrice;
      }
    }

    product.regularPrice = regularPrice;
    if (!updates.category || !product.salePrice) {
      product.salePrice = salePrice;
    }

    const images = product.productImage || [];

    if (req.files && req.files.length > 0) {
      const totalImages = images.length + req.files.length;
      if (totalImages > 4) {
        return res.status(400).json({
          success: false,
          message:
            "You cannot upload more than 4 images. You need to delete previous images to add more.",
        });
      }

      for (let i = 0; i < req.files.length; i++) {
        const resizedBuffer = await sharp(req.files[i].buffer)
          .resize({ width: 440, height: 440, fit: "cover" })
          .toBuffer();

        const result = await uploadBufferToCloudinary(resizedBuffer, "crownify/products");
        images.push(result.secure_url);
      }
      product.productImage = images;
    }

    const variants = [];
    

    if (
      Array.isArray(updates.colors) &&
      Array.isArray(updates.sizes) &&
      Array.isArray(updates.quantities)
    ) {
      if (
        updates.colors.length !== updates.sizes.length ||
        updates.colors.length !== updates.quantities.length
      ) {
    
        return res.status(400).json({
          success: false,
          message: "Colors, sizes, and quantities must have the same length.",
        });
      }

      updates.colors.forEach((color, index) => {
        variants.push({
          color: color,
          size: updates.sizes[index] || null,
          quantity: Math.floor(Number(updates.quantities[index])) || 1,
        });
      });
    } else {
      variants.push({
        color: updates.colors || "Default",
        size: updates.sizes || "ONESIZE",
        quantity: Math.floor(Number(updates.quantities)) || 1,
      });
    }

    product.variants = variants;

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


//code to delete the image

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
