const Cart = require("../../cart/cartSchema");
const Product = require("../../product/productSchema");
const Category = require("../../category/categorySchema");
const Brand = require("../../brand/brandSchema");

// Shared pieces of the checkout path. Wallet, COD and RazorPay all need
// most of these, and each branch previously carried its own copy.

function generateOrderNumber() {
  return `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

/**
 * Records that this user has now used the coupon — first use pushes an
 * entry, later uses bump the counter. Duplicated in three places before
 * (wallet branch, COD branch, and the RazorPay verification callback).
 */
async function recordCouponUsage(coupon, userId) {
  if (!coupon) return;

  const userEntry = coupon.users_applied.find(
    (entry) => entry.user && entry.user.toString() === userId.toString()
  );

  if (!userEntry) {
    coupon.users_applied.push({ user: userId, used_count: 1 });
  } else {
    userEntry.used_count += 1;
  }

  await coupon.save();
}

/**
 * Post-order cart teardown: unlink the cart from the user, drop the
 * session coupon, delete the cart document.
 */
async function clearCartAfterOrder(user, cart, req) {
  if (user && cart) {
    user.cart = user.cart.filter((cartId) => !cartId.equals(cart._id));
    await user.save();
  }
  if (req.session) req.session.coupon = null;
  await Cart.deleteOne({ userId: user._id });
}

/** Thrown by buildOrderItems so the caller can map it to a clean response. */
class CheckoutError extends Error {
  constructor(message, { status = 400, productIdToRemove = null } = {}) {
    super(message);
    this.name = "CheckoutError";
    this.status = status;
    this.productIdToRemove = productIdToRemove;
  }
}

/**
 * Re-validates every cart line against live catalog state at the moment of
 * checkout — the product can have been blocked, its category unlisted, its
 * brand blocked, its variant removed or its stock drawn down since it was
 * added to the cart. Builds the frozen order lines (prices copied off the
 * product NOW, so later price edits don't rewrite history).
 *
 * @throws {CheckoutError} carrying the product to evict from the cart.
 */
async function buildOrderItems(cart) {
  const orderProducts = [];

  for (const cartItem of cart.items) {
    const fail = (message) =>
      new CheckoutError(message, { productIdToRemove: cartItem.productId });

    const product = await Product.findById(cartItem.productId);
    if (!product) throw fail(`Product not found: ${cartItem.productId}`);

    if (product.isBlocked) {
      throw fail(`Product ${product.productName} is currently unavailable, need to apply coupon again`);
    }

    const category = await Category.findById(product.category);
    if (category && category.isListed === false) {
      throw fail(
        `Category of product ${product.productName} is currently unavailable, need to apply coupon again`
      );
    }

    const brand = await Brand.findOne({ brandName: product.brand });
    if (!brand) {
      throw fail(`Brand not found for product ${product.productName}, need to apply coupon again`);
    }
    if (brand.isBlocked) {
      throw fail(
        `Brand of product ${product.productName} is currently unavailable, need to apply coupon again`
      );
    }

    const variantIndex = product.variants.findIndex(
      (v) => v.size === cartItem.variant.size && v.color === cartItem.variant.color
    );
    if (variantIndex === -1) {
      throw fail(`Variant not found for product ${product.productName}`);
    }

    if (product.variants[variantIndex].quantity < cartItem.quantity) {
      throw fail(`Insufficient stock for ${product.productName} in selected variant`);
    }

    orderProducts.push({
      productId: cartItem.productId,
      productName: product.productName,
      variant: {
        color: cartItem.variant.color,
        size: cartItem.variant.size,
      },
      quantity: cartItem.quantity,
      regularPrice: Math.floor(product.regularPrice),
      salePrice: Math.floor(product.salePrice),
      totalPrice: Math.floor(product.salePrice * cartItem.quantity),
      productImage: product.productImage[0],
    });
  }

  return orderProducts;
}

/** Coupon discount for the order total, capped at maxDiscount / the total. */
function calculateCouponDiscount(coupon, totalBeforeDiscount) {
  if (coupon.discountType === "percentage") {
    return Math.floor(
      Math.min(
        (totalBeforeDiscount * coupon.discountAmount) / 100,
        coupon.maxDiscount || Infinity
      )
    );
  }
  if (coupon.discountType === "fixed") {
    return Math.floor(Math.min(coupon.discountAmount, totalBeforeDiscount));
  }
  return 0;
}

async function removeItemFromCart(cartId, productId) {
  await Cart.updateOne({ _id: cartId }, { $pull: { items: { productId } } });
}

module.exports = {
  generateOrderNumber,
  recordCouponUsage,
  clearCartAfterOrder,
  buildOrderItems,
  calculateCouponDiscount,
  removeItemFromCart,
  CheckoutError,
};
