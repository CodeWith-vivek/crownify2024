const bcrypt = require("bcrypt");
const User = require("../user/userSchema");
const Order = require("../order/orderSchema");
const { computeOrderFinancials } = require("../../shared/utils/orderFinancials");
const { loadStorefrontContext } = require("../../shared/utils/storefrontContext");
const { securePassword } = require("../../shared/utils/otpMailer");
const { notFound, badRequest } = require("../../shared/errors/AppError");

// The signed-in account area, free of Express: page data plus the two
// credential-change operations.

const ORDERS_PER_PAGE = 10;

// Status -> CSS class for the order-history badges. A lookup rather than a
// chain of conditionals in the view, and the fallback covers statuses added
// to the enum later without breaking the page.
const BADGE_CLASSES = {
  Delivered: "text-success",
  Shipped: "text-purple",
  "Return requested": "text-orange",
  Returned: "text-info",
  "Return Approved": "text-info",
  "Return Rejected": "text-danger",
  Placed: "text-warning",
  Confirmed: "text-warning",
  canceled: "text-danger",
};

const badgeClassFor = (status) => BADGE_CLASSES[status] || "bg-secondary";

const withProducts = {
  path: "items.productId",
  populate: { path: "category", model: "Category" },
};

/**
 * Profile, Address and Account Details are the same payload: the user with
 * their addresses, plus their whole order history with items whose product
 * is no longer visible dropped, and then orders left with no items dropped.
 */
async function getProfilePageData(userId) {
  const [context, userOrders] = await Promise.all([
    loadStorefrontContext(userId, { withAddresses: true }),
    Order.find({ userId }).populate(withProducts).sort({ orderedAt: -1 }),
  ]);

  const orders = userOrders
    .map((order) => ({
      ...order.toObject(),
      items: order.items.filter((item) => context.isValidProduct(item.productId)),
    }))
    .filter((order) => order.items.length > 0);

  return {
    user: context.userData,
    orders,
    cartCount: context.cartCount,
    wishlistCount: context.wishlistCount,
  };
}

async function getAddressPageData(userId) {
  const data = await getProfilePageData(userId);
  return { ...data, addressCount: data.user?.addresses ? data.user.addresses.length : 0 };
}

/**
 * Order history is loaded separately from getProfilePageData: it's
 * paginated, and it decorates each item with a badge class and each order
 * with live financials.
 */
async function getOrderHistory({ userId, page = 1, limit = ORDERS_PER_PAGE }) {
  const skip = (page - 1) * limit;

  const [context, userOrders, totalOrders] = await Promise.all([
    loadStorefrontContext(userId, { withAddresses: true }),
    Order.find({ userId }).populate(withProducts).sort({ orderedAt: -1 }).skip(skip).limit(limit),
    Order.countDocuments({ userId }),
  ]);

  const orders = userOrders
    .map((order) => {
      const validItems = order.items.filter((item) => context.isValidProduct(item.productId));
      if (validItems.length === 0) return null;

      return {
        ...order.toObject(),
        items: validItems.map((item) => ({
          ...item.toObject(),
          badgeClass: badgeClassFor(item.orderStatus),
        })),
        // order.grandTotal is frozen at checkout — this is the live figure
        // reflecting any cancellations/returns since, without mutating the
        // stored historical total.
        financials: computeOrderFinancials(order),
      };
    })
    .filter(Boolean);

  return {
    user: context.userData,
    orders,
    currentPage: page,
    totalPages: Math.ceil(totalOrders / limit),
    limit,
    cartCount: context.cartCount,
    wishlistCount: context.wishlistCount,
  };
}

/**
 * Name, phone and password in one call. Supplying `password` (the current
 * one) is what authorises the change; the client only sends it when
 * something sensitive is being edited.
 */
async function updateProfileDetails({ userId, name, phone, password, newPassword }) {
  const user = await User.findById(userId).select("+password");
  if (!user) throw notFound("User not found");

  if (password) {
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw badRequest("Incorrect current password");
  }

  if (name && name !== user.name) user.name = name;
  if (phone && phone !== user.phone) user.phone = phone;
  if (newPassword) user.password = await securePassword(newPassword);

  await user.save();
}

async function isCurrentPasswordValid({ userId, password }) {
  const user = await User.findById(userId).select("+password");
  if (!user) throw notFound("User not found");

  return bcrypt.compare(password, user.password);
}

module.exports = {
  getProfilePageData,
  getAddressPageData,
  getOrderHistory,
  updateProfileDetails,
  isCurrentPasswordValid,
  ORDERS_PER_PAGE,
};
