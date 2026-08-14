const bcrypt = require("bcrypt");
const User = require("../user/userSchema");
const Order = require("../order/orderSchema");
const { computeOrderFinancials } = require("../../shared/utils/orderFinancials");
const { loadStorefrontContext } = require("../../shared/utils/storefrontContext");

// The signed-in account area: profile, saved-address view, account
// details, order history, and the two credential-change endpoints.

/**
 * Profile, Address and Account Details pages were three ~60-line copies of
 * the same thing: load the user (with addresses) plus their whole order
 * history, drop items whose product is no longer visible, then drop orders
 * left with no items. Only the extra fields differed.
 */
async function loadProfilePageData(userId) {
  const [context, userOrders] = await Promise.all([
    loadStorefrontContext(userId, { withAddresses: true }),
    Order.find({ userId })
      .populate({
        path: "items.productId",
        populate: { path: "category", model: "Category" },
      })
      .sort({ orderedAt: -1 }),
  ]);

  const filteredOrders = userOrders
    .map((order) => ({
      ...order.toObject(),
      items: order.items.filter((item) => context.isValidProduct(item.productId)),
    }))
    .filter((order) => order.items.length > 0);

  return {
    user: context.userData,
    orders: filteredOrders,
    cartCount: context.cartCount,
    wishlistCount: context.wishlistCount,
  };
}

const userProfile = async (req, res) => {
  try {
    const data = await loadProfilePageData(req.session.user);
    res.json({ success: true, ...data });
  } catch (error) {
    console.error("Error retrieving user profile data:", error);
    res.status(500).json({ success: false, message: "Error loading profile" });
  }
};

const loadUserAddress = async (req, res) => {
  try {
    const data = await loadProfilePageData(req.session.user);
    res.json({
      success: true,
      ...data,
      addressCount: data.user?.addresses ? data.user.addresses.length : 0,
    });
  } catch (error) {
    console.error("Error retrieving user address data:", error);
    res.status(500).json({ success: false, message: "Error loading addresses" });
  }
};

const loadUserAccountDetails = async (req, res) => {
  try {
    const data = await loadProfilePageData(req.session.user);
    res.json({ success: true, ...data });
  } catch (error) {
    console.error("Error retrieving user account details:", error);
    res.status(500).json({ success: false, message: "Error loading account details" });
  }
};

// Order history is its own loader rather than reusing loadProfilePageData:
// it's paginated, and it decorates each item with a status badge class and
// each order with live financials.
const loadUserOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [context, userOrders, totalOrders] = await Promise.all([
      loadStorefrontContext(userId, { withAddresses: true }),
      Order.find({ userId })
        .populate({
          path: "items.productId",
          populate: { path: "category", model: "Category" },
        })
        .sort({ orderedAt: -1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments({ userId }),
    ]);

    const getBadgeClass = (status) => {
      const badgeClasses = {
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
      return badgeClasses[status] || "bg-secondary";
    };

    const processedOrders = userOrders
      .map((order) => {
        const validItems = order.items.filter((item) =>
          context.isValidProduct(item.productId)
        );

        if (validItems.length === 0) return null;

        const processedItems = validItems.map((item) => ({
          ...item.toObject(),
          badgeClass: getBadgeClass(item.orderStatus),
        }));

        return {
          ...order.toObject(),
          items: processedItems,
          // order.grandTotal is frozen at checkout — this is the live figure
          // reflecting any cancellations/returns since, without mutating the
          // stored historical total.
          financials: computeOrderFinancials(order),
        };
      })
      .filter((order) => order !== null);

    res.json({
      success: true,
      user: context.userData,
      orders: processedOrders,
      currentPage: page,
      totalPages: Math.ceil(totalOrders / limit),
      limit,
      cartCount: context.cartCount,
      wishlistCount: context.wishlistCount,
    });
  } catch (error) {
    console.error("Error retrieving user orders:", error);
    res.status(500).json({ success: false, message: "Error loading orders" });
  }
};

const updateProfileDetails = async (req, res) => {
  const { name, phone, password, npassword } = req.body;
  const userId = req.session.user;

  try {
    const user = await User.findById(userId).select("+password");

    // Changing anything requires proving the current password first.
    if (password) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.json({
          success: false,
          error: "Incorrect current password",
        });
      }
    }

    if (name && name !== user.name) user.name = name;
    if (phone && phone !== user.phone) user.phone = phone;
    if (npassword) user.password = await bcrypt.hash(npassword, 10);

    await user.save();
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
};

const validatCurrentPassword = async (req, res) => {
  const { password } = req.body;
  const userId = req.session.user;

  try {
    const user = await User.findById(userId).select("+password");

    if (!user) {
      return res.status(404).json({ valid: false, message: "User  not found" });
    }

    const isValid = await bcrypt.compare(password, user.password);

    res.json({ valid: isValid });
  } catch (error) {
    console.error("Error validating password:", error);
    res.status(500).json({ valid: false, message: "Internal server error" });
  }
};

module.exports = {
  userProfile,
  loadUserAddress,
  loadUserAccountDetails,
  loadUserOrder,
  updateProfileDetails,
  validatCurrentPassword,
};
