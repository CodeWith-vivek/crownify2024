const User = require("../models/userSchema");
const Product = require("../models/productSchema");
const Wishlist=require("../models/wishlistSchema")
const Category=require("../models/categorySchema")
const Brand=require("../models/brandSchema")


//code to load wishlist page

const loadWishlistpage = async (req, res) => {
  try {
    const userId = req.session?.user;
    const user = userId ? await User.findById(userId) : null;

    if (!user) {
      return res.render("Wishlist", {
        user: null,
        wishlistItems: [],
        isWishlistEmpty: true,
        isGuest: true,
      });
    }

    const listedCategories = await Category.find({ isListed: true });
    const unblockedBrands = await Brand.find({ isBlocked: false });

    const listedCategoryIds = new Set(
      listedCategories.map((cat) => cat._id.toString())
    );
    const unblockedBrandNames = new Set(
      unblockedBrands.map((brand) => brand.brandName)
    );

    const wishlist = await Wishlist.findOne({ userId }).populate({
      path: "items.productId",
      model: "Product",
      populate: {
        path: "category",
        model: "Category",
      },
    });

    if (!wishlist || wishlist.items.length === 0) {
      return res.render("Wishlist", {
        user,
        wishlistItems: [],
        isWishlistEmpty: true,
        isGuest: false,
      });
    }

    const wishlistItems = wishlist.items
      .map((item) => {
        const product = item.productId;

        if (
          product.isBlocked || 
          !listedCategoryIds.has(product.category?._id?.toString()) || 
          !unblockedBrandNames.has(product.brand)
        ) {
          return null;
        }

        const variantsBySize = product.variants.reduce((acc, variant) => {
          if (!acc[variant.size]) {
            acc[variant.size] = {
              colors: [],
              totalQuantity: 0,
            };
          }

          if (!acc[variant.size].colors.includes(variant.color)) {
            acc[variant.size].colors.push(variant.color);
          }
          acc[variant.size].totalQuantity += variant.quantity;

          return acc;
        }, {});

        return {
          productId: product._id,
          productName: product.productName,
          productImage: product.productImage[0],
          brand: product.brand,
          category: product.category,
          salePrice: product.salePrice,
          regularPrice: product.regularPrice,
          variants: variantsBySize,
          availableSizes: Object.keys(variantsBySize),
        };
      })
      .filter((item) => item !== null); 

    res.render("Wishlist", {
      user,
      wishlistItems,
      isWishlistEmpty: wishlistItems.length === 0,
      isGuest: false,
    });
  } catch (error) {
    console.error("Wishlist page error:", error);
    res.status(500).render("error", {
      message: "Error loading wishlist",
      error: error.toString(),
    });
  }
};


//code to get color by size

const getColorsBySize = async (req, res) => {
  try {
    const { productId, size } = req.query;

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

  
    const colorVariants = product.variants
      .filter((variant) => variant.size === size)
      .map((variant) => ({
        color: variant.color,
        quantity: variant.quantity,
      }));

   
    const uniqueColors = colorVariants.reduce((acc, variant) => {
      const existingColor = acc.find((item) => item.color === variant.color);

      if (existingColor) {
        existingColor.quantity += variant.quantity;
      } else {
        acc.push({
          color: variant.color,
          quantity: variant.quantity,
        });
      }

      return acc;
    }, []);

    res.json({
      colors: uniqueColors.map((variant) => ({
        color: variant.color,
        quantity: variant.quantity,
      })),
    });
  } catch (error) {
    res.status(500).json({
      error: "Error fetching colors",
      details: error.toString(),
    });
  }
};



//cod eto add to wishlistt

const addToWishlist = async (req, res) => {
  try {
    const { productId } = req.body;

    if (!req.session || !req.session.user) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in to add items to the wishlist.",
      });
    }

    const userId = req.session.user;
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    const salePrice = product.salePrice;
    const productImage = product.productImage[0] || "";
    const category = product.category;

    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      wishlist = new Wishlist({ userId, items: [] });
    }

    const existingItem = wishlist.items.find(
      (item) => item.productId.toString() === productId
    );

    if (existingItem) {
      return res.status(400).json({
        success: false,
        message: "Product is already in your wishlist.",
      });
    }

    const newItem = {
      productId,
      quantity: 1,
      addedAt: new Date(),
      salePrice,
      productImage,
      category,
      productDetails: {
        productName: product.productName,
        productBrand: product.brand,
        salePrice,
        regularPrice: product.regularPrice,
      },
    };

    wishlist.items.push(newItem);
    await wishlist.save();

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (!user.wishlist.includes(wishlist._id)) {
      user.wishlist.push(wishlist._id);
      await user.save();
    }

    return res.status(200).json({
      success: true,
      message: "Product added to wishlist successfully.",
    });
  } catch (error) {
    console.error("Add to wishlist error:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while adding to the wishlist.",
    });
  }
};

//code to remove from wishlist

const removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.body;

    if (!req.session || !req.session.user) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in to remove items from the wishlist.",
      });
    }

    const userId = req.session.user;

    const wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: "Wishlist not found.",
      });
    }

    const itemIndex = wishlist.items.findIndex(
      (item) => item.productId.toString() === productId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Product not found in wishlist.",
      });
    }

  
    wishlist.items.splice(itemIndex, 1);
    await wishlist.save();

  
    return res.status(200).json({
      success: true,
      message: "Product removed from wishlist successfully.",
      wishlistItems: wishlist.items,
    });
  } catch (error) {
    console.error("Remove from wishlist error:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while removing the item from the wishlist.",
    });
  }
};


module.exports={
    loadWishlistpage,
    addToWishlist,
    getColorsBySize,
    removeFromWishlist
 
}


