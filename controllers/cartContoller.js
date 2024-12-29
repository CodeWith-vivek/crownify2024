

const Cart = require("../models/cartSchema");
const Product = require("../models/productSchema");
const User = require("../models/userSchema");
const Coupon = require("../models/couponSchema");
const Category = require("../models/categorySchema");
const Brand = require("../models/brandSchema");

// code to lad cart page 

const loadCartPage = async (req, res) => {
  try {
    const userId = req.session.user;
    let cartItems = [];
    let subtotal = 0;
    const shippingCharge = 40;
    let isCartEmpty = true;

    if (!req.session || !req.session.user) {
      return res.render("cart", {
        user: null,
        cartItems: [],
        subtotal: 0,
        shippingCharge,
        total: shippingCharge,
        isCartEmpty: true,
        isGuest: true,
        coupons: [],
        cartCount: 0,
        wishlistCount: 0,
      });
    }

  
    const [cart, user, listedCategories, unblockedBrands, coupons] =
      await Promise.all([
        Cart.findOne({ userId }).populate({
          path: "items.productId",
          model: "Product",
          populate: {
            path: "category",
            model: "Category",
          },
        }),
        User.findOne({ _id: userId })
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
        Category.find({ isListed: true }),
        Brand.find({ isBlocked: false }),
        Coupon.find({ isActive: true }),
      ]);

  
    const listedCategoryIds = new Set(
      listedCategories.map((cat) => cat._id.toString())
    );
    const unblockedBrandNames = new Set(
      unblockedBrands.map((brand) => brand.brandName)
    );

 
    const isValidProduct = (product) => {
      return (
        product &&
        !product.isBlocked &&
        listedCategoryIds.has(product.category?._id?.toString()) &&
        unblockedBrandNames.has(product.brand)
      );
    };

    // Process cart items
    if (cart && cart.items.length > 0) {
      cartItems = cart.items
        .map((item) => {
          const product = item.productId;

          if (!isValidProduct(product)) {
            return null;
          }

          const variant = product.variants.find(
            (v) =>
              v.size === item.variant.size && v.color === item.variant.color
          );

          if (!variant) {
            console.error("Variant not found for item:", item);
            return null;
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
            ),
          };
        })
        .filter((item) => item !== null);

      isCartEmpty = cartItems.length === 0;
    }

    // Calculate subtotal and total
    subtotal = Math.floor(
      cartItems.reduce((total, item) => total + item.itemTotal, 0)
    );
    const total = Math.floor(subtotal + shippingCharge);

    // Calculate filtered counts
    const cartCount = user?.cart?.[0]?.items
      ? user.cart[0].items.filter((item) => isValidProduct(item.productId))
          .length
      : 0;

    const wishlistCount = user?.wishlist?.[0]?.items
      ? user.wishlist[0].items.filter((item) => isValidProduct(item.productId))
          .length
      : 0;

    return res.render("cart", {
      user,
      cartItems,
      subtotal,
      shippingCharge,
      total,
      isCartEmpty,
      isGuest: false,
      coupons,
      cartCount,
      wishlistCount,
    });
  } catch (error) {
    console.error("Cart page error:", error.stack || error);
    // Since the error view isn't found, let's send a basic error response
    res.status(500).send({
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

    const product = await Product.findById(productId).populate("category"); 
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

   
    if (product.isBlocked) {
      return res.status(400).json({
        success: false,
        message:
          "This product is currently blocked and cannot be added to the cart",
      });
    }

    
   if (!product.category || !product.category.isListed) {
     return res.status(400).json({
       success: false,
       message:
         "This product's category is currently not listed and cannot be added to the cart",
     });
   }
   const brand = await Brand.findOne({ brandName: product.brand });
   if (brand && brand.isBlocked) {
     return res.status(400).json({
       success: false,
       message:
         "This product's brand is currently blocked and cannot be added to the cart",
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

    // Check if the user is logged in
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

    // Find the index of the item to remove
    const itemIndex = cart.items.findIndex(
      (item) =>
        item.productId.equals(productId) &&
        item.variant.size === size &&
        item.variant.color === color
    );

    // Check if the item exists in the cart
    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Item not found in cart",
      });
    }

    console.log("Cart items before removal:", cart.items);

    // Remove the item from the cart
    cart.items.splice(itemIndex, 1);
    console.log("Cart items after removal:", cart.items);

    // Recalculate the total price
    const updatedSubtotal = cart.items.reduce(
      (total, item) => total + item.totalPrice,
      0
    );
    const shippingCharge = cart.cartSummary.shippingCharge; // Assuming this is fixed
    const discount = cart.cartSummary.discount || 0; // Set to 0 if not defined

    // Update the cart summary
    cart.cartSummary.subtotal = updatedSubtotal;
    cart.cartSummary.total = Math.floor(
      updatedSubtotal + shippingCharge - discount
    );

    // Save the updated cart
    const savedCart = await cart.save();
    console.log("Saved cart:", savedCart);

    // Check if the cart is now empty
    if (cart.items.length === 0) {
      // If the cart is empty, remove it from the user's cart array
      await User.updateOne(
        { _id: req.session.user },
        { $pull: { cart: cart._id } }
      );
      console.log("Cart removed from user's cart array");
    }

    return res.status(200).json({
      success: true,
      message: "Item removed from cart successfully",
      newTotal: cart.cartSummary.total,
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


    cartItem.quantity = parseInt(quantity);

 
    const itemTotal = Math.floor(
      cartItem.quantity *
        (cartItem.productId.salePrice || cartItem.productId.regularPrice)
    );

 
    const subtotal = Math.floor(
      cart.items.reduce((total, item) => {
        return (
          total +
          item.quantity *
            (item.productId.salePrice || item.productId.regularPrice)
        );
      }, 0)
    );

    const shippingCharge = 40;
    const total = Math.floor(subtotal + shippingCharge);

   
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
