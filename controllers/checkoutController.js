const User = require("../models/userSchema");
const Cart = require("../models/cartSchema");
const Product = require("../models/productSchema");
const Coupon=require("../models/couponSchema")

//code to load checkout page

const loadCheckout = async (req, res) => {
  try {
    const userId = req.session.user;
    console.log("User ID from session:", userId);

    // Validate session
    if (!userId) {
      console.log("User not logged in, redirecting to login page");
      return res.redirect("/login");
    }

    // Fetch user data and cart items
    const userData = await User.findById(userId).populate("addresses");
    if (!userData) {
      console.log("User data not found, redirecting to login page");
      return res.redirect("/login");
    }
    const addressCount = userData.addresses ? userData.addresses.length : 0;

    const cartItems = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      model: "Product",
    });
    if (!cartItems || !cartItems.items || cartItems.items.length === 0) {
      console.log("No cart items found, redirecting to /cart");
      return res.redirect("/cart");
    }

    // Filter valid cart items
    const validCartItems = cartItems.items.filter((item) => item.quantity > 0);
    if (validCartItems.length === 0) {
      console.log("No valid cart items found, redirecting to /cart");
      return res.redirect("/cart");
    }

    // Calculate subtotal
    const subtotal = validCartItems.reduce((total, item) => {
      const product = item.productId;
      const price = product.salePrice || product.regularPrice || 0;
      return total + item.quantity * price;
    }, 0);

    const shipping = 40; // Fixed shipping cost
    let total = subtotal + shipping;
    let discountAmount = 0;

    // Apply coupon discount if available
    if (req.session.coupon) {
      const { discount } = req.session.coupon;
      if (discount) {
        let originalDiscountAmount = discount.calculatedAmount || 0;
        discountAmount = originalDiscountAmount;

        // Apply maximum discount cap if applicable
        if (discount.maxCap) {
          discountAmount = Math.min(discountAmount, discount.maxCap);
        }
      }
    }

    // Final total calculation
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

    const coupons = await Coupon.find({ isActive: true });

    // Render checkout page
    res.render("checkout3", {
      coupons,
      user: userData,
      addressCount,
      products,
      addresses: userData.addresses,
      cartItems: validCartItems,
      subtotal,
      shipping,
      discountAmount,
      total,
      coupon: req.session.coupon || null,
    });

    console.log("Checkout page rendered successfully");

    // Clear coupon session after rendering
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
    for (const item of cart.items) {
      const currentProduct = await Product.findById(item.productId).lean();

      if (!currentProduct) {
        outOfStockItems.push({
          productName: "Unknown Product",
          message: "Product no longer exists",
        });
        continue;
      }

      const cartItemVariant = item.variant;

      const variant = currentProduct.variants.find(
        (v) =>
          v.color.toLowerCase() === cartItemVariant.color.toLowerCase() &&
          v.size.toLowerCase() === cartItemVariant.size.toLowerCase()
      );

      if (!variant) {
        outOfStockItems.push({
          productName: currentProduct.productName,
          size: item.size || "undefined",
          color: item.color || "undefined",
          message: "Product variant no longer available",
        });
        continue;
      }

      if (variant.stockLevel === 0) {
        outOfStockItems.push({
          productName: currentProduct.productName,
          size: item.size || "undefined",
          color: item.color || "undefined",
          message: "Out of stock",
        });
      } else if (variant.stockLevel < item.quantity) {
        outOfStockItems.push({
          productName: currentProduct.productName,
          size: item.size || "undefined",
          color: item.color || "undefined",
          availableStock: variant.stockLevel,
          requestedQuantity: item.quantity,
          message: `Only ${variant.stockLevel} items available`,
        });
      }
    }

    if (outOfStockItems.length > 0) {
      return res.json({
        success: false,
        message:
          "Some items in your cart are out of stock or have insufficient stock",
        outOfStockItems,
      });
    }

    return res.json({
      success: true,
      message: "Stock validation successful",
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
