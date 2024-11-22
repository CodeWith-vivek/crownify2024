const User=require("../models/userSchema")
const Cart=require("../models/cartSchema")
const Product=require("../models/productSchema")

const loadCheckout = async (req, res) => {
  try {
    const userId = req.session.user;

    // Fetch user data with addresses
    const userData = await User.findById(userId).populate("addresses");

    // Fetch cart items and populate product details
    const cartItems = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      model: "Product",
    });

    // Check if the cart is empty or contains items with zero quantity
    if (!cartItems || !cartItems.items || cartItems.items.length === 0) {
      return res.redirect("/cart"); // Redirect to cart page
    }

    // Filter out items with zero quantity
    const validCartItems = cartItems.items.filter((item) => item.quantity > 0);

    if (validCartItems.length === 0) {
      return res.redirect("/cart"); // Redirect if all items have zero quantity
    }

    console.log("itemssss", validCartItems);

    // Calculate subtotal
    const subtotal = validCartItems.reduce((total, item) => {
      const product = item.productId; // Populated product details
      return (
        total + item.quantity * (product.salePrice || product.regularPrice)
      );
    }, 0);

    console.log("Subtotal:", subtotal);

    // Shipping cost
    const shipping = 40;

    // Calculate total
    const total = subtotal + shipping;
    console.log("Total:", total);

    // Prepare products array for rendering
    const products = validCartItems.map((item) => {
      const product = item.productId; // Populated product details
      const price = product.salePrice || product.regularPrice || 0;
      const itemTotaleach = item.quantity * price;
      return {
        productId: product._id,
        productName: product.productName,
        productImage: product.productImage[0],
        productBrand: product.brand, // Adjust field names as per your schema
        quantity: item.quantity,
        itemTotal: itemTotaleach,
        size: item.variant?.size || null, // Handle cases where `variant` is undefined
        color: item.variant?.color || null, // Handle cases where `variant` is undefined
        price: price,
      };
    });

    console.log("Products:", products);
    console.log("wooooooh",userData);
    const user=await User.findOne({_id:userId})
  
    

    // Render the checkout page with the required data
    res.render("checkout", {
      user,
  
     
     
      products,
      addresses: userData.addresses,
      cartItems: validCartItems, // Pass only the valid items
      subtotal,
      shipping,
      total,
    });
  } catch (error) {
    console.error("Error on loading checkout:", error);
    res.redirect("/pageNotFound");
  }
};

const validateQuantity = async (req, res) => {
  try {
    // Get user's cart
    const userId = req.session.user;
    const cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart || !cart.items || cart.items.length === 0) {
      return res.json({
        success: false,
        message: "Your cart is empty",
      });
    }

    const outOfStockItems = [];
    const invalidItems = [];

    // Check each cart item with fresh product data
    for (const item of cart.items) {
      // Fetch the most current product data INSIDE the loop
      const currentProduct = await Product.findById(item.productId).lean();

      // Log the current product and cart item
      console.log("Current Product:", currentProduct);
      console.log("Cart Item:", item);

      // Validate product existence
      if (!currentProduct) {
        outOfStockItems.push({
          productName: "Unknown Product",
          message: "Product no longer exists",
        });
        continue;
      }

      // Find the specific variant
      const cartItemVariant = item.variant;
      console.log("Cart Item Variant:", cartItemVariant);

      // Find the specific variant using the cart item's variant details
      const variant = currentProduct.variants.find(
        (v) =>
          v.color.toLowerCase() === cartItemVariant.color.toLowerCase() &&
          v.size.toLowerCase() === cartItemVariant.size.toLowerCase()
      );

      console.log("Found Variant:", variant);

      // Log the found variant
      console.log("Found Variant:", variant);

      // Comprehensive stock validation
      if (!variant) {
        outOfStockItems.push({
          productName: currentProduct.productName,
          size: item.size || "undefined", // Log size
          color: item.color || "undefined", // Log color
          message: "Product variant no longer available",
        });
        continue;
      }

      // Check quantity and stock
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

    // Handle out of stock or invalid items
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
module.exports={
    loadCheckout,
    validateQuantity
   
}