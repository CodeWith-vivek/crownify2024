const User = require("../user/userSchema");

// Admin customer management, free of Express.

const CUSTOMERS_PER_PAGE = 4;

async function listCustomers({ search = "", page = 1, limit = CUSTOMERS_PER_PAGE }) {
  // Built once and reused for both the page and the count — the original
  // repeated the same filter verbatim in two separate queries, and its
  // regex had no "i" flag, so searching for a customer by lowercase name
  // or email matched nothing unless the case happened to line up exactly.
  const filter = {
    isAdmin: false,
    $or: [
      { name: { $regex: ".*" + search + ".*", $options: "i" } },
      { email: { $regex: ".*" + search + ".*", $options: "i" } },
    ],
  };

  const [users, count] = await Promise.all([
    User.find(filter)
      .limit(limit)
      .skip((page - 1) * limit)
      .exec(),
    User.countDocuments(filter),
  ]);

  return { users, search, currentPage: page, totalPages: Math.ceil(count / limit) };
}

async function setCustomerBlocked({ customerId, isBlocked }) {
  await User.updateOne({ _id: customerId }, { $set: { isBlocked } });
  return { message: isBlocked ? "Customer blocked" : "Customer unblocked" };
}

module.exports = { listCustomers, setCustomerBlocked, CUSTOMERS_PER_PAGE };
