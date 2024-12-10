const User = require("../models/userSchema");
const Cart = require("../models/cartSchema");
const Product = require("../models/productSchema");

//code to load checkout page

const loadCheckout = async (req, res) => {
  try {
    const userId = req.session.user;
    console.log("User ID from session:", userId);

    // Fetch user data and cart items
    const userData = await User.findById(userId).populate("addresses");
    console.log("User data fetched:", userData);

    const cartItems = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      model: "Product",
    });
    console.log("Cart items fetched:", cartItems);

    // Redirect to cart if there are no items
    if (!cartItems || !cartItems.items || cartItems.items.length === 0) {
      console.log("No cart items found, redirecting to /cart");
      return res.redirect("/cart");
    }

    // Filter valid cart items
    const validCartItems = cartItems.items.filter((item) => item.quantity > 0);
    console.log("Valid cart items after filtering:", validCartItems);

    if (validCartItems.length === 0) {
      console.log("No valid cart items found, redirecting to /cart");
      return res.redirect("/cart");
    }

    // Calculate subtotal
    const subtotal = validCartItems.reduce((total, item) => {
      const product = item.productId;
      const price = product.salePrice || product.regularPrice || 0;
      console.log(
        `Calculating subtotal: Adding ₹${item.quantity * price} for ${
          item.quantity
        } units of ${product.productName}`
      );
      return total + item.quantity * price;
    }, 0);
    console.log("Subtotal calculated:", subtotal);

    const shipping = 40; // Fixed shipping cost
    console.log("Shipping cost:", shipping);

    // Calculate total
    let total = subtotal + shipping;
    console.log("Total before discount:", total);

    let discountAmount = 0;

    // Apply coupon discount if available
   if (req.session.coupon) {
  const { discount } = req.session.coupon; // Ensure discount exists
  console.log("Coupon found:", req.session.coupon);

  if (discount) {
    let originalDiscountAmount;
    let maxDiscount = discount.calculatedAmount; // Max discount cap if applicable

    if (discount.type === "percentage") {
      // Use the pre-calculated discount amount if available
      originalDiscountAmount = discount.calculatedAmount; // Store pre-calculated discount
      discountAmount = originalDiscountAmount; // Directly use the pre-calculated discount
      console.log(
        `Using pre-calculated percentage discount amount: ₹${discountAmount}`
      );
    } else if (discount.type === "fixed") {
      // Apply fixed discount using pre-calculated value
      originalDiscountAmount = discount.calculatedAmount; // Store fixed discount
      discountAmount = originalDiscountAmount; // Initialize the discount amount
      console.log(`Using pre-calculated fixed discount: ₹${discountAmount}`);
    }

    console.log(`Discount amount before max cap: ₹${discountAmount}`);
    console.log(`Max discount cap: ₹${maxDiscount}`);

    // Apply maximum discount cap if available
    if (maxDiscount) {
      discountAmount = Math.min(discountAmount, maxDiscount); // No rounding, retain exact values
      if (originalDiscountAmount > maxDiscount) {
        console.log(
          `Max discount cap applied: ₹${maxDiscount}, Discount reduced from ₹${originalDiscountAmount} to ₹${discountAmount}`
        );
      } else {
        console.log(
          `No discount cap needed; Discount amount: ₹${discountAmount}`
        );
      }
    }
  }
}

    // Final total calculation
    total -= discountAmount;
    if (total < 0) total = 0; // Ensure total does not go below zero
    console.log("Total after applying discount:", total);

    // Prepare product details for rendering
    const products = validCartItems.map((item) => {
      const product = item.productId;
      const price = product.salePrice || product.regularPrice || 0;
      const itemTotalEach = item.quantity * price;
      console.log("Product details:", {
        productId: product._id,
        productName: product.productName,
        price: price,
        itemTotalEach,
      });
      return {
        productId: product._id,
        productName: product.productName,
        productImage: product.productImage[0],
        productBrand: product.brand,
        quantity: item.quantity,
        itemTotal: itemTotalEach,
        size: item.variant?.size || null,
        color: item.variant?.color || null,
        price: price,
      };
    });

    console.log("Prepared product details:", products);

    // Render checkout page
    res.render("checkout", {
      user: userData,
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
    console.log("Cleared coupon from session");
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
