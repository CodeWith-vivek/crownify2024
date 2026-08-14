const Cart = require("../cart/cartSchema");
const Product = require("../product/productSchema");
const Coupon = require("../coupon/couponSchema");
const Brand = require("../brand/brandSchema");
const { AppError } = require("../../shared/errors/AppError");
const { loadStorefrontContext } = require("../../shared/utils/storefrontContext");
const { SHIPPING_CHARGE } = require("../cart/cart.service");

// Checkout rules, free of Express. Same contract as order.service.js and
// cart.service.js: plain arguments in, plain values or an AppError out.

/**
 * A checkout blocker the user must act on — not logged in, empty cart.
 * Each carries the SPA route the client should bounce to, which rides in
 * `details` so it gets merged into the JSON response body.
 */
const blocked = (message, status, redirect) =>
  new AppError(message, { status, details: { redirect } });

/**
 * Applies a session coupon to a total. The stored `calculatedAmount` was
 * computed when the coupon was applied, so it is re-clamped to `maxCap`
 * here in case the cart shrank in between.
 */
function resolveDiscount(sessionCoupon) {
  const discount = sessionCoupon?.discount;
  if (!discount) return 0;

  const amount = discount.calculatedAmount || 0;
  return discount.maxCap ? Math.min(amount, discount.maxCap) : amount;
}

async function getCheckoutPage({ userId, sessionCoupon }) {
  if (!userId) throw blocked("Please log in", 401, "/login");

  const { userData, isValidProduct, cartCount, wishlistCount } =
    await loadStorefrontContext(userId, { withAddresses: true });

  if (!userData) throw blocked("Please log in", 401, "/login");

  const cart = await Cart.findOne({ userId }).populate({
    path: "items.productId",
    model: "Product",
    populate: { path: "category", model: "Category" },
  });

  const validCartItems = (cart?.items || []).filter(
    (item) => isValidProduct(item.productId) && item.quantity > 0
  );

  if (validCartItems.length === 0) throw blocked("Your cart is empty", 400, "/cart");

  const priceOf = (product) => product.salePrice || product.regularPrice || 0;

  const subtotal = validCartItems.reduce(
    (total, item) => total + item.quantity * priceOf(item.productId),
    0
  );

  const discountAmount = resolveDiscount(sessionCoupon);
  const total = Math.max(0, subtotal + SHIPPING_CHARGE - discountAmount);

  const products = validCartItems.map((item) => {
    const product = item.productId;
    const price = priceOf(product);
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

  return {
    // The coupon is spent by rendering checkout — the controller drops it
    // from the session once this data has been captured.
    clearSessionCoupon: true,
    result: {
      coupons,
      user: userData,
      addressCount: userData.addresses ? userData.addresses.length : 0,
      products,
      addresses: userData.addresses,
      cartItems: validCartItems,
      subtotal,
      shipping: SHIPPING_CHARGE,
      discountAmount,
      total,
      coupon: sessionCoupon || null,
      cartCount,
      wishlistCount,
    },
  };
}

/**
 * Classifies one cart line against the catalog as it stands right now.
 * Returns null when the line is fine to buy.
 */
function classifyLine(item, product, blockedBrandNames) {
  if (!product) {
    return {
      bucket: "outOfStock",
      entry: { productName: "Unknown Product", message: "Product no longer exists" },
    };
  }

  if (product.isBlocked) {
    return {
      bucket: "blocked",
      entry: { productName: product.productName, reason: "The product itself is blocked." },
    };
  }

  if (product.category && !product.category.isListed) {
    return {
      bucket: "blocked",
      entry: {
        productName: product.productName,
        reason: `Category "${product.category.name}" is blocked.`,
      },
    };
  }

  if (blockedBrandNames.has(product.brand)) {
    return {
      bucket: "blocked",
      entry: {
        productName: product.productName,
        reason: `Brand "${product.brand}" is blocked.`,
      },
    };
  }

  const wanted = item.variant;
  const variant = product.variants.find(
    (v) =>
      v.color.toLowerCase() === wanted.color.toLowerCase() &&
      v.size.toLowerCase() === wanted.size.toLowerCase()
  );

  const identity = { productName: product.productName, size: wanted.size, color: wanted.color };

  if (!variant) {
    return {
      bucket: "outOfStock",
      entry: { ...identity, message: "Product variant no longer available" },
    };
  }

  if (variant.quantity === 0) {
    return { bucket: "outOfStock", entry: { ...identity, message: "Out of stock" } };
  }

  if (variant.quantity < item.quantity) {
    return {
      bucket: "outOfStock",
      entry: {
        ...identity,
        availableStock: variant.quantity,
        requestedQuantity: item.quantity,
        message: `Only ${variant.quantity} items available`,
      },
    };
  }

  return null;
}

const sameLine = (a, b) =>
  a.productId.equals(b.productId) &&
  a.variant.size === b.variant.size &&
  a.variant.color === b.variant.color;

/**
 * Last stock/visibility gate before payment. Unbuyable lines are pruned
 * from the stored cart, and the caller is told what was dropped.
 *
 * This is a validation *result*, not a failure — an unbuyable cart still
 * resolves (with success:false in the payload), matching what the client
 * already expects. Only genuine bugs throw.
 */
async function validateCartForCheckout(userId) {
  const cart = await Cart.findOne({ userId }).populate("items.productId");

  if (!cart || !cart.items || cart.items.length === 0) {
    return { success: false, message: "Your cart is empty" };
  }

  // One lookup for the whole pass instead of a Brand.findOne per line.
  const blockedBrandNames = new Set(
    (await Brand.find({ isBlocked: true }).select("brandName").lean()).map((b) => b.brandName)
  );

  const outOfStockItems = [];
  const blockedItems = [];
  const validCartItems = [];

  for (const item of cart.items) {
    const product = await Product.findById(item.productId).populate("category").lean();
    const problem = classifyLine(item, product, blockedBrandNames);

    if (!problem) {
      validCartItems.push(item);
    } else if (problem.bucket === "blocked") {
      blockedItems.push(problem.entry);
    } else {
      outOfStockItems.push(problem.entry);
    }
  }

  // Lines are matched on product AND variant. Matching on productId alone
  // let a sold-out variant survive whenever any other variant of the same
  // product was still buyable.
  cart.items = cart.items.filter((item) => validCartItems.some((valid) => sameLine(valid, item)));
  await cart.save();

  if (outOfStockItems.length > 0 || blockedItems.length > 0) {
    return {
      success: false,
      message:
        "Some items in your cart are out of stock or restricted due to blocked categories/brands.",
      outOfStockItems,
      blockedItems,
    };
  }

  return { success: true, message: "Stock and restriction validation successful" };
}

module.exports = { getCheckoutPage, validateCartForCheckout };
