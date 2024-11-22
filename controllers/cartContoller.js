

const Cart = require("../models/cartSchema");
const Product = require("../models/productSchema");
const User = require("../models/userSchema");


const loadCartPage = async (req, res) => {
  try {
    let cartItems = [];
    let subtotal = 0;
    const shippingCharge = 40;
    let isCartEmpty = true;

    // Check if the user is authenticated
    if (req.session && req.session.user) {
      const userId = req.session.user; // Assuming user ID is stored directly
      console.log("Loading cart for user:", userId);

      // Fetch the cart for the authenticated user
      const cart = await Cart.findOne({ userId }).populate({
        path: "items.productId",
        model: "Product",
        populate: {
          path: "category",
          model: "Category",
        },
      });

      if (cart && cart.items.length > 0) {
        cartItems = cart.items
          .map((item) => {
            const product = item.productId; // Define product here
            const variant = product.variants.find(
              (v) =>
                v.size === item.variant.size && v.color === item.variant.color
            );

            // Check if variant is found
            if (!variant) {
              console.error("Variant not found for item:", item);
              return null; // or handle this case as needed
            }

            return {
              product,
              productCategory: product.category
                ? product.category.name
                : "Unknown",
              productName: product.productName,
              productBrand: product.productBrand,
              productImage: product.productImage[0], // Use the first image from the array
              quantity: item.quantity,
              color: item.variant.color, // Ensure color is included
              size: item.variant.size, // Ensure size is included
              selectedVariantStockLevel: variant.quantity, // Ensure stock level is included
              itemTotal:
                item.quantity * (product.salePrice || product.regularPrice),
            };
          })
          .filter((item) => item !== null); // Filter out any null entries

        isCartEmpty = false;
      }

      // Calculate subtotal and total
      subtotal = cartItems.reduce((total, item) => total + item.itemTotal, 0);
    } else {
      console.log("Loading empty cart for guest user");
      isCartEmpty = true; // Cart is empty for guest
    }

    // Calculate total
    const total = subtotal + shippingCharge;

    const userId = req.session.user;
    const user = await User.findOne({ _id: userId });

    // Render the cart page
    res.render("cart", {
      user,
      cartItems,
      subtotal,
      shippingCharge,
      total,
      isCartEmpty,
      isGuest: !req.session.user,
    });
  } catch (error) {
    console.error("Cart page error:", error.stack || error);
    res.status(500).render("error", {
      message: "Error loading cart",
      error: error.toString(),
    });
  }
};

const addToCart = async (req, res) => {
  try {
    const { productId, size, color, quantity } = req.body;
    console.log("Adding to cart:", { productId, size, color, quantity });

    // Check if the user is authenticated
    if (!req.session || !req.session.user) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in to add items to the cart",
        redirectTo: "/login",
      });
    }

    // Find or create the cart for the user
    let cart = await Cart.findOne({ userId: req.session.user });
    if (!cart) {
      console.log("Creating new cart for user:", req.session.user);
      cart = new Cart({ userId: req.session.user, items: [] });
    }

    // Find the product to add to the cart
    const product = await Product.findById(productId);
    if (!product) {
      console.error("Product not found:", productId);
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    // Check for the product variant
    const variant = product.variants.find(
      (v) => v.size === size && v.color === color
    );
    if (!variant || variant.quantity < quantity) {
      console.error("Variant out of stock or insufficient quantity:", {
        variant,
        quantity,
      });
      return res.status(400).json({
        success: false,
        message: "Selected variant is out of stock or insufficient quantity",
      });
    }

    // Check if the item already exists in the cart
    const existingItemIndex = cart.items.findIndex(
      (item) =>
        item.productId.equals(productId) &&
        item.size === size &&
        item.color === color
    );

    const totalPrice = (product.salePrice || product.regularPrice) * quantity;

    if (existingItemIndex > -1) {
      // Update existing item
      const newQuantity =
        cart.items[existingItemIndex].quantity + parseInt(quantity);
      if (newQuantity > variant.quantity) {
        console.error("Cannot add more items than available in stock");
        return res.status(400).json({
          success: false,
          message: "Cannot add more items than available in stock",
        });
      }

      cart.items[existingItemIndex].quantity = newQuantity;
      cart.items[existingItemIndex].totalPrice = totalPrice; // Update total price
      console.log(
        "Updated existing item quantity:",
        cart.items[existingItemIndex]
      );
    } else {
      // Add new item to cart
      cart.items.push({
        productId,
        productBrand: product.productBrand,
        productName: product.productName,
        productImage: product.productImage[0], // Use the first image from the array
        size,
        color,
        quantity: parseInt(quantity),
        totalPrice, // Add total price
        salePrice: product.salePrice || product.regularPrice, // Add salePrice
        regularPrice: product.regularPrice, // Add regularPrice
        variant: {
          size,
          color,
        },
        selectedVariantStockLevel: variant.quantity, // Add the stock level of the selected variant
      });
      console.log("Added new item to cart:", {
        productId,
        size,
        color,
        quantity,
      });
    }

    // Save the cart
    await cart.save();

    // Update the User document to reference the cart
    await User.findByIdAndUpdate(
      req.session.user,
      { $addToSet: { cart: cart._id } },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Item added to cart successfully",
      cart,
    });
  } catch (error) {
    console.error("Error adding to cart:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while adding to cart",
    });
  }
};
const getVarientQuantity = async (req, res) => {
  try {
    const { id } = req.params;
    const { size, color } = req.query;
    const product = await Product.findById(id).select("variants");

    if (!product) {
      console.log("Product not found");
      return res.status(404).json({ message: "Product not found" });
    }

    const variant = product.variants.find(
      (v) => v.size === size && v.color === color
    );

    if (!variant) {
      console.log("Variant not found for size and color");
      return res
        .status(404)
        .json({ message: "Variant not found or out of stock" });
    }

    console.log(`Stock for ${color} (size ${size}):`, variant.quantity);
    res.json({ stock: variant.quantity });
  } catch (error) {
    console.error("Error fetching stock:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
const getOverallStock = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id).select("variants");

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const totalStock = product.variants.reduce((sum, variant) => {
      return sum + (variant.quantity || 0);
    }, 0);

    res.json({ totalStock });
  } catch (error) {
    console.error("Error fetching overall stock:", error.stack || error);
    res.status(500).json({ message: "Internal server error" });
  }
};
const updateStockAfterAdd = async (productId, size, color, quantity) => {
  const product = await Product.findById(productId);
  const variant = product.variants.find(
    (v) => v.size === size && v.color === color
  );

  if (variant) {
    variant.quantity -= quantity;
    await product.save();
  }
};
const deleteFromCart = async (req, res) => {
  try {
    const { productId, size, color } = req.body; // Get productId, size, and color from request body
    console.log("Request Body:", req.body); // Debugging statement

    // Check if the user is authenticated
    if (!req.session || !req.session.user) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in to remove items from the cart",
      });
    }

    const cart = await Cart.findOne({ userId: req.session.user });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    // Find the index of the item to be removed
    const itemIndex = cart.items.findIndex(
      (item) =>
        item.productId.equals(productId) && // Ensure productId is compared correctly
        item.variant.size === size &&
        item.variant.color === color
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Item not found in cart",
      });
    }

    // Remove the item from the cart
    cart.items.splice(itemIndex, 1);

    // Calculate the new total after removal
    const updatedCartTotal = cart.items.reduce((total, item) => {
      return total + item.itemTotal; // Assuming itemTotal is the total price for each item
    }, 0);

    // Save the updated cart
    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Item removed from cart successfully",
      newTotal: updatedCartTotal, // Return the new total
    });
  } catch (error) {
    console.error("Error removing item from cart:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while removing item from cart",
    });
  }
};
const updateCart = async (req, res) => {
  try {
    const { productId, size, color, quantity } = req.body;

    // Check if user is authenticated
    if (!req.session || !req.session.user) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in to update cart",
      });
    }

    // Find the user's cart
    const cart = await Cart.findOne({ userId: req.session.user }).populate({
      path: "items.productId",
      model: "Product",
    });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    // Find the specific item in cart
    const cartItem = cart.items.find(
      (item) =>
        item.productId._id.toString() === productId &&
        item.variant.size === size &&
        item.variant.color === color
    );

    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: "Item not found in cart",
      });
    }

    // Update quantity
    cartItem.quantity = parseInt(quantity);

    // Calculate new item total
    const itemTotal =
      cartItem.quantity *
      (cartItem.productId.salePrice || cartItem.productId.regularPrice);

    // Calculate new cart totals
    const subtotal = cart.items.reduce((total, item) => {
      return (
        total +
        item.quantity *
          (item.productId.salePrice || item.productId.regularPrice)
      );
    }, 0);

    const shippingCharge = 40; // Your fixed shipping charge
    const total = subtotal + shippingCharge;
    console.log("subbbbbb",subtotal);

    console.log("toooooootal",total);
    
    

    // Save the updated cart
    await cart.save();

    return res.status(200).json({
      success: true,
      itemTotal: itemTotal.toFixed(2),
      cartSummary: {
        subtotal: subtotal.toFixed(2),
        shippingCharge: shippingCharge.toFixed(2),
        total: total.toFixed(2),
      },
    });
  } catch (error) {
    console.error("Error updating cart:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while updating cart",
    });
  }
};
module.exports = {
  loadCartPage,
  addToCart,
  getOverallStock,
  getVarientQuantity,
  updateStockAfterAdd,
  deleteFromCart,
  updateCart
};
