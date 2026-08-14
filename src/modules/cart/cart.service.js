const Cart = require("./cartSchema");
const Product = require("../product/productSchema");
const User = require("../user/userSchema");
const Coupon = require("../coupon/couponSchema");
const Brand = require("../brand/brandSchema");
const { notFound, badRequest, AppError } = require("../../shared/errors/AppError");
const { loadStorefrontContext } = require("../../shared/utils/storefrontContext");

// Cart rules, free of Express. Same contract as order.service.js: plain
// arguments in, plain values or an AppError out, nothing touching req/res.

const SHIPPING_CHARGE = 40;

/**
 * The cart page for a guest — no user, no counts, but still the shipping
 * figure so the UI can render its summary consistently.
 */
function emptyGuestCart() {
  return {
    user: null,
    cartItems: [],
    subtotal: 0,
    shippingCharge: SHIPPING_CHARGE,
    total: SHIPPING_CHARGE,
    isCartEmpty: true,
    isGuest: true,
    coupons: [],
    cartCount: 0,
    wishlistCount: 0,
  };
}

async function getCartPage(userId) {
  if (!userId) return emptyGuestCart();

  const [cart, context, coupons] = await Promise.all([
    Cart.findOne({ userId }).populate({
      path: "items.productId",
      model: "Product",
      populate: { path: "category", model: "Category" },
    }),
    loadStorefrontContext(userId),
    Coupon.find({ isActive: true }),
  ]);

  const { isValidProduct, userData, cartCount, wishlistCount } = context;

  // A line is dropped from the view (not the DB) when its product has
  // since been blocked/unlisted, or when the exact variant no longer
  // exists on the product — either way it isn't purchasable now.
  const cartItems = (cart?.items || [])
    .map((item) => {
      const product = item.productId;
      if (!isValidProduct(product)) return null;

      const variant = product.variants.find(
        (v) => v.size === item.variant.size && v.color === item.variant.color
      );
      if (!variant) return null;

      return {
        product,
        productCategory: product.category ? product.category.name : "Unknown",
        productName: product.productName,
        productBrand: product.brand,
        productImage: product.productImage[0],
        quantity: item.quantity,
        color: item.variant.color,
        size: item.variant.size,
        selectedVariantStockLevel: variant.quantity,
        itemTotal: Math.floor(item.quantity * (product.salePrice || product.regularPrice)),
      };
    })
    .filter(Boolean);

  const subtotal = Math.floor(cartItems.reduce((total, item) => total + item.itemTotal, 0));

  return {
    user: userData,
    cartItems,
    subtotal,
    shippingCharge: SHIPPING_CHARGE,
    total: Math.floor(subtotal + SHIPPING_CHARGE),
    isCartEmpty: cartItems.length === 0,
    isGuest: false,
    coupons,
    cartCount,
    wishlistCount,
  };
}

/**
 * Re-checks purchasability at add time — the product page may have been
 * open for a while, and the product/category/brand could have been
 * blocked or the variant sold out since it rendered.
 */
async function addToCart({ userId, productId, size, color, quantity }) {
  let cart = await Cart.findOne({ userId });
  if (!cart) cart = new Cart({ userId, items: [] });

  const product = await Product.findById(productId).populate("category");
  if (!product) throw notFound("Product not found");

  if (product.isBlocked) {
    throw badRequest("This product is currently blocked and cannot be added to the cart");
  }

  if (!product.category || !product.category.isListed) {
    throw badRequest(
      "This product's category is currently not listed and cannot be added to the cart"
    );
  }

  const brand = await Brand.findOne({ brandName: product.brand });
  if (brand && brand.isBlocked) {
    throw badRequest("This product's brand is currently blocked and cannot be added to the cart");
  }

  const variant = product.variants.find((v) => v.size === size && v.color === color);
  if (!variant || variant.quantity < quantity) {
    throw badRequest("Selected variant is out of stock or insufficient quantity");
  }

  const isDuplicateVariant = cart.items.some(
    (item) =>
      item.productId.toString() === productId.toString() &&
      item.variant.size === size &&
      item.variant.color === color
  );

  if (isDuplicateVariant) {
    // AppError.details is spread into the response body, and the client
    // reads a `details` key off that body — hence the deliberate nesting.
    throw new AppError("This exact product variant is already in your cart", {
      status: 400,
      details: { details: { productId, size, color } },
    });
  }

  const unitPrice = product.salePrice || product.regularPrice;

  cart.items.push({
    productId,
    productBrand: product.productBrand,
    productName: product.productName,
    productImage: product.productImage[0],
    size,
    color,
    quantity: parseInt(quantity),
    totalPrice: unitPrice * quantity,
    salePrice: unitPrice,
    regularPrice: product.regularPrice,
    variant: { size, color },
    selectedVariantStockLevel: variant.quantity,
  });

  await cart.save();

  // Stock is NOT decremented here — that happens at order placement.
  // Reserving on add would leak stock for every abandoned cart.
  await User.findByIdAndUpdate(userId, { $addToSet: { cart: cart._id } }, { new: true });

  return { message: "Item added to cart successfully", cart };
}

async function removeFromCart({ userId, productId, size, color }) {
  const cart = await Cart.findOne({ userId });
  if (!cart) throw notFound("Cart not found");

  const itemIndex = cart.items.findIndex(
    (item) =>
      item.productId.equals(productId) &&
      item.variant.size === size &&
      item.variant.color === color
  );

  if (itemIndex === -1) throw notFound("Item not found in cart");

  cart.items.splice(itemIndex, 1);

  const updatedSubtotal = cart.items.reduce((total, item) => total + item.totalPrice, 0);
  const shippingCharge = cart.cartSummary.shippingCharge;
  const discount = cart.cartSummary.discount || 0;

  cart.cartSummary.subtotal = updatedSubtotal;
  cart.cartSummary.total = Math.floor(updatedSubtotal + shippingCharge - discount);

  await cart.save();

  // An emptied cart is unlinked from the user so header counts and the
  // "you have a cart" checks stay accurate.
  if (cart.items.length === 0) {
    await User.updateOne({ _id: userId }, { $pull: { cart: cart._id } });
  }

  return { message: "Item removed from cart successfully", newTotal: cart.cartSummary.total };
}

async function updateCartQuantity({ userId, productId, size, color, quantity }) {
  const cart = await Cart.findOne({ userId }).populate({
    path: "items.productId",
    model: "Product",
  });

  if (!cart) throw notFound("Cart not found");

  const cartItem = cart.items.find(
    (item) =>
      item.productId._id.toString() === productId &&
      item.variant.size === size &&
      item.variant.color === color
  );

  if (!cartItem) throw notFound("Item not found in cart");

  cartItem.quantity = parseInt(quantity);

  const priceOf = (item) => item.productId.salePrice || item.productId.regularPrice;
  const itemTotal = Math.floor(cartItem.quantity * priceOf(cartItem));
  const subtotal = Math.floor(
    cart.items.reduce((total, item) => total + item.quantity * priceOf(item), 0)
  );

  await cart.save();

  return {
    itemTotal,
    cartSummary: {
      subtotal,
      shippingCharge: SHIPPING_CHARGE,
      total: Math.floor(subtotal + SHIPPING_CHARGE),
    },
  };
}

async function getVariantStock({ productId, size, color }) {
  const product = await Product.findById(productId).select("variants");
  if (!product) throw notFound("Product not found");

  const variant = product.variants.find((v) => v.size === size && v.color === color);
  if (!variant) throw notFound("Variant not found or out of stock");

  return { stock: variant.quantity };
}

module.exports = {
  getCartPage,
  addToCart,
  removeFromCart,
  updateCartQuantity,
  getVariantStock,
  SHIPPING_CHARGE,
};
