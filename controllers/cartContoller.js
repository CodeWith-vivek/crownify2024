

const Cart = require("../models/cartSchema");
const Product = require("../models/productSchema");
const User = require("../models/userSchema");
const Coupon = require("../models/couponSchema");

// code to lad cart page 

const loadCartPage = async (req, res) => {
  try {
  
    let cartItems = [];
    let subtotal = 0;
    const shippingCharge = 40;
    let isCartEmpty = true;

    if (req.session && req.session.user) {
      const userId = req.session.user;
      


      // Fetch the user's cart with product and category details
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
              return null; // Skip the item if the variant is not found
            }

            return {
              product,
              productCategory: product.category
                ? product.category.name
                : "Unknown",
              productName: product.productName,
              productBrand: product.brand,
              productImage: product.productImage[0],
              quantity: item.quantity,
              color: item.variant.color,
              size: item.variant.size,
              selectedVariantStockLevel: variant.quantity,
              itemTotal: Math.floor(
                item.quantity * (product.salePrice || product.regularPrice)
              ), // Floor the item total
            };
          })
          .filter((item) => item !== null);

        isCartEmpty = false;
      }

      // Calculate subtotal with floored values
      subtotal = Math.floor(
        cartItems.reduce((total, item) => total + item.itemTotal, 0)
      );
    } else {
      isCartEmpty = true;
    }

    // Calculate total with floored values
    const total = Math.floor(subtotal + shippingCharge);

    const userId = req.session.user;
    const user = await User.findOne({ _id: userId });
    const coupons = await Coupon.find({ isActive: true });

    // Render the cart page with floored values
    res.render("cart", {
      user,
      cartItems,
      subtotal,
      shippingCharge,
      total,
      isCartEmpty,
      isGuest: !req.session.user,
      coupons,
    });
  } catch (error) {
    console.error("Cart page error:", error.stack || error);
    res.status(500).render("error", {
      message: "Error loading cart",
      error: error.toString(),
    });
  }
};

// code to add items to cart

const addToCart = async (req, res) => {
  try {
    const { productId, size, color, quantity } = req.body;

    if (!req.session || !req.session.user) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in to add items to the cart",
        redirectTo: "/login",
      });
    }

    let cart = await Cart.findOne({ userId: req.session.user });
    if (!cart) {
      cart = new Cart({ userId: req.session.user, items: [] });
    }

    const product = await Product.findById(productId).populate("category"); // Assuming category is a reference
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    // Check if the product is blocked
    if (product.isBlocked) {
      return res.status(400).json({
        success: false,
        message:
          "This product is currently blocked and cannot be added to the cart",
      });
    }

    // Check if the category is blocked
   if (!product.category || !product.category.isListed) {
     return res.status(400).json({
       success: false,
       message:
         "This product's category is currently not listed and cannot be added to the cart",
     });
   }

    const variant = product.variants.find(
      (v) => v.size === size && v.color === color
    );
    if (!variant || variant.quantity < quantity) {
      return res.status(400).json({
        success: false,
        message: "Selected variant is out of stock or insufficient quantity",
      });
    }

    const isDuplicateVariant = cart.items.some(
      (item) =>
        item.productId.toString() === productId.toString() &&
        item.variant.size === size &&
        item.variant.color === color
    );

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
      variant: { size, color },
      selectedVariantStockLevel: variant.quantity,
    });

    await cart.save();

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


// code to get stock of each variant 

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

// code to delete item from cart

const deleteFromCart = async (req, res) => {
  try {
    const { productId, size, color } = req.body;

    // Check if user is logged in
    if (!req.session || !req.session.user) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in to remove items from the cart",
      });
    }

    // Find the user's cart
    const cart = await Cart.findOne({ userId: req.session.user });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    // Find the item index in the cart
    const itemIndex = cart.items.findIndex(
      (item) =>
        item.productId.equals(productId) &&
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

    // Recalculate the cart total and floor it
    const updatedCartTotal = Math.floor(
      cart.items.reduce((total, item) => {
        return total + item.itemTotal;
      }, 0)
    );

    // Save the updated cart
    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Item removed from cart successfully",
      newTotal: updatedCartTotal,
    });
  } catch (error) {
    console.error("Error removing item from cart:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while removing item from cart",
    });
  }
};
// code to update cart

const updateCart = async (req, res) => {
  try {
    const { productId, size, color, quantity } = req.body;

    if (!req.session || !req.session.user) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in to update cart",
      });
    }

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

    // Update the item quantity
    cartItem.quantity = parseInt(quantity);

    // Calculate the item total and floor it
    const itemTotal = Math.floor(
      cartItem.quantity *
        (cartItem.productId.salePrice || cartItem.productId.regularPrice)
    );

    // Calculate the subtotal and floor it
    const subtotal = Math.floor(
      cart.items.reduce((total, item) => {
        return (
          total +
          item.quantity *
            (item.productId.salePrice || item.productId.regularPrice)
        );
      }, 0)
    );

    const shippingCharge = 40; // Flat shipping charge
    const total = Math.floor(subtotal + shippingCharge);

    // Save the updated cart
    await cart.save();

    return res.status(200).json({
      success: true,
      itemTotal: itemTotal,
      cartSummary: {
        subtotal: subtotal,
        shippingCharge: shippingCharge,
        total: total,
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
