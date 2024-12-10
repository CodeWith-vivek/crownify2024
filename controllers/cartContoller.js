

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
      const coupons = await Coupon.find({ isActive: true });

    res.render("cart", {
      user,
      cartItems,
      subtotal,
      shippingCharge,
      total,
      isCartEmpty,
      isGuest: !req.session.user,
      coupons
    });
  } catch (error) {
    console.error("Cart page error:", error.stack || error);
    res.status(500).render("error", {
      message: "Error loading cart",
      error: error.toString(),
    });
  }
};
// const loadCartPage = async (req, res) => {
//   try {
//     let cartItems = [];
//     let subtotal = 0;
//     const shippingCharge = 40;
//     let isCartEmpty = true;
//     let discountAmount = 0; // To hold the discount amount if a coupon is applied
//     let couponCode = ""; // To store the applied coupon code

//     if (req.session && req.session.user) {
//       const userId = req.session.user;

//       const cart = await Cart.findOne({ userId }).populate({
//         path: "items.productId",
//         model: "Product",
//         populate: {
//           path: "category",
//           model: "Category",
//         },
//       });

//       if (cart && cart.items.length > 0) {
//         cartItems = cart.items
//           .map((item) => {
//             const product = item.productId;
//             const variant = product.variants.find(
//               (v) =>
//                 v.size === item.variant.size && v.color === item.variant.color
//             );

//             if (!variant) {
//               console.error("Variant not found for item:", item);
//               return null;
//             }

//             return {
//               product,
//               productCategory: product.category
//                 ? product.category.name
//                 : "Unknown",
//               productName: product.productName,
//               productBrand: product.brand,
//               productImage: product.productImage[0],
//               quantity: item.quantity,
//               color: item.variant.color,
//               size: item.variant.size,
//               selectedVariantStockLevel: variant.quantity,
//               itemTotal:
//                 item.quantity * (product.salePrice || product.regularPrice),
//             };
//           })
//           .filter((item) => item !== null);

//         isCartEmpty = false;
//       }

//       subtotal = cartItems.reduce((total, item) => total + item.itemTotal, 0);

//       // Check for coupon code in session (if any)
//       couponCode = req.session.couponCode || "";

//       // Apply discount if a coupon is present
//       if (couponCode) {
//         const coupon = await Coupon.findOne({ code: couponCode });
//         if (coupon && coupon.isActive && coupon.expiryDate > new Date()) {
//           discountAmount = calculateDiscount(coupon, subtotal);
//         }
//       }
//     } else {
//       isCartEmpty = true;
//     }

//     const total = subtotal + shippingCharge - discountAmount; // Update total

//     const userId = req.session.user;
//     const user = await User.findOne({ _id: userId });

//     // Fetch available coupons
//     const coupons = await Coupon.find({ isActive: true }); // Adjust the query as needed

//     res.render("cart", { // Ensure you specify the correct path
//       user,
//       cartItems,
//       subtotal,
//       shippingCharge,
//       total,
//       discountAmount, // Pass discount amount to the view
//       couponCode, // Pass the coupon code to the view
//       isCartEmpty,
//       isGuest: !req.session.user,
//       coupons, // Pass coupons to the view
//     });
//   } catch (error) {
//     console.error("Cart page error:", error.stack || error);
//     res.status(500).render("error", {
//       message: "Error loading cart",
//       error: error.toString(),
//     });
//   }
// };


// Function to calculate discount based on coupon type
const calculateDiscount = (coupon, subtotal) => {
  if (coupon.discountType === "percentage") {
    return (subtotal * coupon.discountAmount) / 100;
  } else if (coupon.discountType === "fixed") {
    return coupon.discountAmount;
  }
  return 0; // No discount
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

   
    const product = await Product.findById(productId);
    if (!product) {
      
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
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
      variant: { size, color }, // Ensure variant is saved
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

   
    cart.items.splice(itemIndex, 1);

  
    const updatedCartTotal = cart.items.reduce((total, item) => {
      return total + item.itemTotal;
    }, 0);

  
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

   
    cartItem.quantity = parseInt(quantity);

   
    const itemTotal =
      cartItem.quantity *
      (cartItem.productId.salePrice || cartItem.productId.regularPrice);

    
    const subtotal = cart.items.reduce((total, item) => {
      return (
        total +
        item.quantity *
          (item.productId.salePrice || item.productId.regularPrice)
      );
    }, 0);

    const shippingCharge = 40;
    const total = subtotal + shippingCharge;
 
    

 
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
