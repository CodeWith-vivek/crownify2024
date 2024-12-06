const User = require("../models/userSchema");
const Product = require("../models/productSchema");
const Wishlist=require("../models/wishlistSchema")

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

    const wishlist = await Wishlist.findOne({ userId }).populate({
      path: "items.productId",
      model: "Product",
      populate: {
        path: "category",
        model: "Category",
      },
    });

    const wishlistItems = wishlist.items.map((item) => {
      const product = item.productId;

      // Group variants by size
      const variantsBySize = product.variants.reduce((acc, variant) => {
        if (!acc[variant.size]) {
          acc[variant.size] = {
            colors: [],
            totalQuantity: 0,
          };
        }

        // Add unique colors and accumulate quantity
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
        category:product.category,
        salePrice: product.salePrice,
        regularPrice: product.regularPrice,
        variants: variantsBySize,
        availableSizes: Object.keys(variantsBySize),
      };
    });

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

const getColorsBySize = async (req, res) => {
  try {
    const { productId, size } = req.query;

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Filter variants by size and get unique colors with their quantities
    const colorVariants = product.variants
      .filter((variant) => variant.size === size)
      .map((variant) => ({
        color: variant.color,
        quantity: variant.quantity,
      }));

    // Remove duplicate colors and keep track of total quantity
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
    const productImage = product.productImage[0] || ""; // Use the first image
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

    // Remove the item from the wishlist
    wishlist.items.splice(itemIndex, 1);
    await wishlist.save();

    // Send updated wishlist items back to the client
    return res.status(200).json({
      success: true,
      message: "Product removed from wishlist successfully.",
      wishlistItems: wishlist.items, // Updated wishlist items
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


