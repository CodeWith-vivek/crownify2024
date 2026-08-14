const bcrypt = require("bcrypt");
const User = require("../user/userSchema");
const { asString } = require("../../shared/utils/sanitize");

// Admin session rules, free of Express.
//
// Admin auth is deliberately a separate session flag (req.session.admin)
// from the shopper session (req.session.user) — the two are independent, so
// being signed in as a customer never grants admin access.
//
// A rejected login resolves with `ok: false` rather than throwing, for the
// same reason as the shopper login: the controller must answer 200,
// because apiClient turns any 401 into an `auth:unauthorized` broadcast
// that bounces the viewer to the login screen they are already on.

async function login({ email, password }) {
  const admin = await User.findOne({ email: asString(email), isAdmin: true }).select("+password");

  if (!admin) return { ok: false, message: "You are not Admin !" };

  if (!(await bcrypt.compare(password, admin.password))) {
    return { ok: false, message: "Invalid Password" };
  }

  return {
    ok: true,
    message: "Login Successful",
    redirectUrl: "/admin/dashboard",
    session: { admin: true },
  };
}

module.exports = { login };
