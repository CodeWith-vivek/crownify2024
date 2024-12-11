const Category = require("../models/categorySchema");
const Product = require("../models/productSchema");

// code to load category in admin side

const categoryInfo = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const categoryData = await Category.find({})
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const totalCategories = await Category.countDocuments();
    const totalPages = Math.ceil(totalCategories / limit);
    res.render("category", {
      cat: categoryData,
      currentPage: page,
      totalPages,
      totalCategories,
    });
  } catch (error) {
    console.log("Error fetching category data", error);
    res.redirect("/admin/pageerror");
  }
};

// code to add a new category

const addCategory = async (req, res) => {
  let { name, description } = req.body;
  try {
    if (!name || !description) {
      return res
        .status(400)
        .json({ error: "Name and description are required." });
    }
    name = name.toUpperCase();


    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });

    if (existingCategory) {
      return res.status(409).json({ error: "Category already exists." });
    }

    const newCategory = new Category({ name, description });
    await newCategory.save();
    res.status(201).json({ message: "Category added successfully." });
  } catch (error) {
    console.error("Error adding category:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

//code to add category offer


const addCategoryOffer = async (req, res) => {
  try {
    const percentage = parseInt(req.body.percentage);
    const categoryId = req.body.categoryId;

    // Find the category
    const category = await Category.findById(categoryId);
    if (!category) {
      return res
        .status(404)
        .json({ status: false, message: "Category not found" });
    }

    // Find all products in the category
    const products = await Product.find({ category: category._id });

    // Check if any product has a higher product offer
    const hasHigherProductOffer = products.some(
      (product) => product.productOffer > percentage
    );

    // Apply offer only to products with `productOffer === 0`
    const productsToUpdate = products.filter(
      (product) => product.productOffer <= percentage
    );

    // If no products are eligible for the category offer, reject the request
    if (productsToUpdate.length === 0 && hasHigherProductOffer) {
      return res.json({
        status: false,
        message:
          "Products within this category already have a higher product offer",
      });
    }

    // Update the category offer
    await Category.updateOne(
      { _id: categoryId },
      { $set: { categoryOffer: percentage } }
    );

    for (const product of productsToUpdate) {
      if (product.productOffer > 0) {
        // Save the existing product offer in a temporary field
        product.previousProductOffer = product.productOffer;
        product.productOffer = 0; // Reset the product offer
      }

      // Apply the category offer to sale price
      product.salePrice =
        product.regularPrice - (product.regularPrice * percentage) / 100;

      await product.save();
    }

    res.json({
      status: true,
      message:
        "Category offer applied successfully to products with no existing or lower offers!",
    });
  } catch (error) {
    console.error("Error adding category offer:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

//code to  remove category offer

const removeCategoryOffer = async (req, res) => {
  try {
    const categoryId = req.body.categoryId;

    // Find the category
    const category = await Category.findById(categoryId);
    if (!category) {
      return res
        .status(404)
        .json({ status: false, message: "Category not found" });
    }

    // Find all products in the category
    const products = await Product.find({ category: category._id });

    for (const product of products) {
      if (product.previousProductOffer) {
        // Restore the previous product offer
        product.productOffer = product.previousProductOffer;
        product.salePrice =
          product.regularPrice -
          (product.regularPrice * product.previousProductOffer) / 100;

        // Clear the temporary field
        product.previousProductOffer = undefined;
      } else {
        // If no previous offer exists, reset sale price to regular price
        product.salePrice = product.regularPrice;
      }

      await product.save();
    }

    // Remove the category offer
    category.categoryOffer = 0;
    await category.save();

    res.json({ status: true, message: "Category offer removed successfully!" });
  } catch (error) {
    console.error("Error removing category offer:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};
const getListCategory=async(req,res)=>{
  try {
    let id=req.query.id
    await Category.updateOne({_id:id},{$set:{isListed:false}})
    res.redirect("/admin/category")
    
  } catch (error) {
    res.redirect("/pageerror")
    
  }
}



const getUnlistCategory=async(req,res)=>{
  try {
    let id = req.query.id;
    await Category.updateOne({ _id: id }, { $set: { isListed: true } });
    res.redirect("/admin/category");
  } catch (error) {
    res.redirect("/pageerror");
  }

}

//code to load edit Category

const getEditCategory =async(req,res)=>{
  try {
    const id =req.query.id
    const category=await Category.findOne({_id:id})
    res.render("edit-category",{category:category})
    
  } catch (error) {
    res.redirect("/pageerror")
    
  }

}

//code to edit category

const editCategory = async (req, res) => {
  try {
    const id = req.params.id;
    const { categoryName, description } = req.body;

  
    const existingCategory = await Category.findOne({ name: categoryName });
    if (existingCategory && existingCategory._id.toString() !== id) {
      return res
        .status(400)
        .json({ error: "Category exists, please choose another name" });
    }

    
    const updateCategory = await Category.findByIdAndUpdate(
      id,
      {
        name: categoryName,
        description: description,
      },
      { new: true }
    );

    if (updateCategory) {
      res.redirect("/admin/category");
    } else {
      res.status(400).json({ error: "Category not found" });
    }
  } catch (error) {
    console.log(error); 
    res.status(500).json({ error: "Internal error" });
  }
};
module.exports = {
  categoryInfo,
  addCategory,
  addCategoryOffer,
  removeCategoryOffer,
  getListCategory,
  getUnlistCategory,
  getEditCategory,
  editCategory
};
