const Product = require("./productSchema");
const Category = require("../category/categorySchema");
const Brand = require("../brand/brandSchema");

// Admin-side read endpoints: the data behind the add/edit forms and the
// paginated product list.

const getProductAddPage = async (req, res) => {
  try {
    const category = await Category.find({ isListed: true });
    const brand = await Brand.find({ isBlocked: false });
    res.json({ success: true, cat: category, brand: brand });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error loading page" });
  }
};

const getAllProducts = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 6;

    const searchFilter = {
      $or: [
        { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
        { brand: { $regex: new RegExp(".*" + search + ".*", "i") } },
      ],
    };

    const [productData, count, category, brand] = await Promise.all([
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
    productData.forEach((product) => {
      product.totalQuantity = product.variants
        ? product.variants.reduce((sum, variant) => sum + (variant.quantity || 0), 0)
        : 0;
    });

    if (category && brand) {
      res.json({
        success: true,
        data: productData,
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        cat: category,
        brand: brand,
      });
    } else {
      res.status(404).json({ success: false, message: "Not found" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: "Error loading products" });
  }
};

const getEditProduct = async (req, res) => {
  try {
    const id = req.query.id;
    const [product, category, brand] = await Promise.all([
      Product.findOne({ _id: id }),
      // Unfiltered on purpose: an existing product may reference a category
      // or brand that has since been unlisted/blocked, and the edit form
      // still has to render its current value in the dropdown.
      Category.find({}),
      Brand.find({}),
    ]);
    res.json({ success: true, product, cat: category, brand });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error loading product" });
  }
};

module.exports = { getProductAddPage, getAllProducts, getEditProduct };
