

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
      const userId = req.session.user;

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
            const product = item.productId;
            const variant = product.variants.find(
              (v) =>
                v.size === item.variant.size && v.color === item.variant.color
            );

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
              productBrand: product.brand, // Use brand as string
              productImage: product.productImage[0],
              quantity: item.quantity,
              color: item.variant.color,
              size: item.variant.size,
              selectedVariantStockLevel: variant.quantity,
              itemTotal:
                item.quantity * (product.salePrice || product.regularPrice),
            };
          })
          .filter((item) => item !== null);

        isCartEmpty = false;
      }

      subtotal = cartItems.reduce((total, item) => total + item.itemTotal, 0);
    } else {
      isCartEmpty = true;
    }

    const total = subtotal + shippingCharge;

    const userId = req.session.user;
    const user = await User.findOne({ _id: userId });

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
     
      cart = new Cart({ userId: req.session.user, items: [] });
    }

    // Find the product to add to the cart
    const product = await Product.findById(productId);
    if (!product) {
      
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    // Check for the product variant
    const variant = product.variants.find(
      (v) => v.size === size && v.color === color
    );
    if (!variant || variant.quantity < quantity) {
      
      return res.status(400).json({
        success: false,
        message: "Selected variant is out of stock or insufficient quantity",
      });
    }

    // Detailed logging of existing cart items
   

    // Check for duplicate variant specifically in the variant object
    const isDuplicateVariant = cart.items.some(
      (item) =>
        item.productId.toString() === productId.toString() &&
        item.variant.size === size &&
        item.variant.color === color
    );

    // Prevent adding the same variant
    if (isDuplicateVariant) {
     
      return res.status(400).json({
        success: false,
        message: "This exact product variant is already in your cart",
        details: {
          productId,
          size,
          color,
        },
      });
    }

    const totalPrice = (product.salePrice || product.regularPrice) * quantity;

    // Add new item to cart
    cart.items.push({
      productId,
      productBrand: product.productBrand,
      productName: product.productName,
      productImage: product.productImage[0],
      size,
      color,
      quantity: parseInt(quantity),
      totalPrice,
      salePrice: product.salePrice || product.regularPrice,
      regularPrice: product.regularPrice,
      variant: { size, color }, // Ensure variant is saved
      selectedVariantStockLevel: variant.quantity,
    });

  

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
  
    return res.status(500).json({
      success: false,
      message: "An error occurred while adding to cart",
      error: error.message,
    });
  }
};
const getVarientQuantity = async (req, res) => {
  try {
    const { id } = req.params;
    const { size, color } = req.query;
    const product = await Product.findById(id).select("variants");

    if (!product) {
   
      return res.status(404).json({ message: "Product not found" });
    }

    const variant = product.variants.find(
      (v) => v.size === size && v.color === color
    );

    if (!variant) {
    
      return res
        .status(404)
        .json({ message: "Variant not found or out of stock" });
    }

  
    res.json({ stock: variant.quantity });
  } catch (error) {
    console.error("Error fetching stock:", error);
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
   // Debugging statement

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
  getVarientQuantity,
  updateStockAfterAdd,
  deleteFromCart,
  updateCart
};
