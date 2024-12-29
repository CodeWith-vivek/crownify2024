const User = require("../models/userSchema");
const Cart = require("../models/cartSchema");
const Product = require("../models/productSchema");
const Coupon=require("../models/couponSchema")
const Brand = require("../models/brandSchema");
const Category=require("../models/categorySchema")

//code to load checkout page


const loadCheckout = async (req, res) => {
  try {
    const userId = req.session.user;

    // Redirect to login if user is not logged in
    if (!userId) {
      return res.redirect("/login");
    }

    // Fetch all required data in parallel
    const [listedCategories, unblockedBrands, userData] = await Promise.all([
      Category.find({ isListed: true }),
      Brand.find({ isBlocked: false }),
      User.findById(userId)
        .populate({
          path: "addresses",
        })
        .populate({
          path: "cart",
          populate: {
            path: "items.productId",
            model: "Product",
            populate: {
              path: "category",
              model: "Category",
            },
          },
        })
        .populate({
          path: "wishlist",
          populate: {
            path: "items.productId",
            model: "Product",
            populate: {
              path: "category",
              model: "Category",
            },
          },
        }),
    ]);

    // Redirect to login if user data is not found
    if (!userData) {
      return res.redirect("/login");
    }

    // Create Sets for efficient lookups
    const listedCategoryIds = new Set(
      listedCategories.map((cat) => cat._id.toString())
    );
    const unblockedBrandNames = new Set(
      unblockedBrands.map((brand) => brand.brandName)
    );

    // Comprehensive product validity check
    const isValidProduct = (product) => {
      return (
        product &&
        !product.isBlocked &&
        listedCategoryIds.has(product.category?._id?.toString()) &&
        unblockedBrandNames.has(product.brand)
      );
    };

    // Calculate filtered cart and wishlist counts
    const cartCount = userData?.cart?.[0]?.items
      ? userData.cart[0].items.filter((item) => isValidProduct(item.productId))
          .length
      : 0;

    const wishlistCount = userData?.wishlist?.[0]?.items
      ? userData.wishlist[0].items.filter((item) =>
          isValidProduct(item.productId)
        ).length
      : 0;

    // Fetch cart items with detailed population
    const cartItems = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      model: "Product",
      populate: {
        path: "category",
        model: "Category",
      },
    });

    // Redirect to cart if no cart items are found
    if (!cartItems || !cartItems.items || cartItems.items.length === 0) {
      return res.redirect("/cart");
    }

    // Filter valid cart items based on product validity and quantity
    const validCartItems = cartItems.items.filter(
      (item) => isValidProduct(item.productId) && item.quantity > 0
    );

    if (validCartItems.length === 0) {
      return res.redirect("/cart");
    }

    // Calculate subtotal for valid cart items
    const subtotal = validCartItems.reduce((total, item) => {
      const product = item.productId;
      const price = product.salePrice || product.regularPrice || 0;
      return total + item.quantity * price;
    }, 0);

    const shipping = 40;
    let total = subtotal + shipping;
    let discountAmount = 0;

    // Apply coupon discount if available
    if (req.session.coupon) {
      const { discount } = req.session.coupon;
      if (discount) {
        let originalDiscountAmount = discount.calculatedAmount || 0;
        discountAmount = originalDiscountAmount;

        // Ensure discount does not exceed max cap
        if (discount.maxCap) {
          discountAmount = Math.min(discountAmount, discount.maxCap);
        }
      }
    }

    // Calculate total after applying discount
    total = Math.max(0, total - discountAmount);

    // Prepare product details for rendering
    const products = validCartItems.map((item) => {
      const product = item.productId;
      const price = product.salePrice || product.regularPrice || 0;
      return {
        productId: product._id,
        productName: product.productName,
        productImage: product.productImage?.[0],
        productBrand: product.brand,
        quantity: item.quantity,
        itemTotal: item.quantity * price,
        size: item.variant?.size || null,
        color: item.variant?.color || null,
        price,
      };
    });

    // Fetch active coupons
    const coupons = await Coupon.find({ isActive: true });

    // Render the checkout page with all necessary data
    res.render("checkout3", {
      coupons,
      user: userData,
      addressCount: userData.addresses ? userData.addresses.length : 0,
      products,
      addresses: userData.addresses,
      cartItems: validCartItems,
      subtotal,
      shipping,
      discountAmount,
      total,
      coupon: req.session.coupon || null,
      cartCount,
      wishlistCount,
    });

    // Clear the coupon session variable after rendering
    req.session.coupon = null;
  } catch (error) {
    console.error("Error on loading checkout:", error);
    res.redirect("/pageNotFound");
  }
};

//code to validate the quantity


const validateQuantity = async (req, res) => {
  try {
    const userId = req.session.user;
    const cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart || !cart.items || cart.items.length === 0) {
      return res.json({
        success: false,
        message: "Your cart is empty",
      });
    }

    const outOfStockItems = [];
    const blockedItems = [];
    const validCartItems = [];

    for (const item of cart.items) {
      const currentProduct = await Product.findById(item.productId)
        .populate("category")
        .populate("brand")
        .lean();

      if (!currentProduct) {
        outOfStockItems.push({
          productName: "Unknown Product",
          message: "Product no longer exists",
        });
        continue;
      }

      // Check if the product is blocked
      if (currentProduct.isBlocked) {
        blockedItems.push({
          productName: currentProduct.productName,
          reason: "The product itself is blocked.",
        });
        continue;
      }

      // Check if the category is blocked
      if (currentProduct.category && !currentProduct.category.isListed) {
        blockedItems.push({
          productName: currentProduct.productName,
          reason: `Category "${currentProduct.category.name}" is blocked.`,
        });
        continue;
      }

      const brand = await Brand.findOne({ brandName: currentProduct.brand });
      if (brand && brand.isBlocked) {
        blockedItems.push({
          productName: currentProduct.productName,
          reason: `Brand "${currentProduct.brand}" is blocked.`,
        });
        continue;
      }

      const cartItemVariant = item.variant;

      // Check for variant
      const variant = currentProduct.variants.find(
        (v) =>
          v.color.toLowerCase() === cartItemVariant.color.toLowerCase() &&
          v.size.toLowerCase() === cartItemVariant.size.toLowerCase()
      );

      if (!variant) {
        outOfStockItems.push({
          productName: currentProduct.productName,
          size: cartItemVariant.size,
          color: cartItemVariant.color,
          message: "Product variant no longer available",
        });
        continue;
      }

      // Check stock levels
      if (variant.quantity === 0) {
        outOfStockItems.push({
          productName: currentProduct.productName,
          size: cartItemVariant.size,
          color: cartItemVariant.color,
          message: "Out of stock",
        });
      } else if (variant.quantity < item.quantity) {
        outOfStockItems.push({
          productName: currentProduct.productName,
          size: cartItemVariant.size,
          color: cartItemVariant.color,
          availableStock: variant.quantity,
          requestedQuantity: item.quantity,
          message: `Only ${variant.quantity} items available`,
        });
      } else {
        // If the item is valid, keep it in the cart
        validCartItems.push(item);
      }
    }

    // Update the cart to exclude blocked items only
    cart.items = cart.items.filter((item) =>
      validCartItems.some((validItem) =>
        validItem.productId.equals(item.productId)
      )
    );
    await cart.save();

    if (outOfStockItems.length > 0 || blockedItems.length > 0) {
      return res.json({
        success: false,
        message:
          "Some items in your cart are out of stock or restricted due to blocked categories/brands.",
        outOfStockItems,
        blockedItems,
      });
    }

    return res.json({
      success: true,
      message: "Stock and restriction validation successful",
    });
  } catch (error) {
    console.error("Error during checkout validation:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while validating your cart",
    });
  }
};

module.exports = {
  loadCheckout,
  validateQuantity,
 
};
