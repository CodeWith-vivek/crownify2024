const bcrypt = require("bcrypt");
const User = require("../user/userSchema");
const { asString } = require("../../shared/utils/sanitize");

// Admin session lifecycle. Admin auth is deliberately a separate session
// flag (req.session.admin) from the shopper session (req.session.user) —
// the two are independent, so being signed in as a customer never grants
// admin access.

const pageerror = async (req, res) => {
  res.json({ success: true });
};

const loadLogin = (req, res) => {
  if (req.session.admin) {
    return res.json({ success: true, redirect: "/admin/dashboard" });
  }
  res.json({ success: true, admin: false });
};

// Lets the admin SPA hydrate its auth state on load/refresh.
const getCurrentAdmin = (req, res) => {
  res.json({ success: true, admin: !!req.session.admin });
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await User.findOne({ email: asString(email), isAdmin: true }).select("+password");

    if (admin) {
      const passwordMatch = await bcrypt.compare(password, admin.password);
      if (passwordMatch) {
        req.session.admin = true;

        return res.json({
          success: true,
          message: "Login Successful",
          redirectUrl: "/admin/dashboard",
        });
      } else {
        return res.json({ success: false, message: "Invalid Password" });
      }
    } else {
      return res.json({ success: false, message: "You are not Admin !" });
    }
  } catch (error) {
    console.error("Login error:", error);
    return res.json({ success: false, message: "An error occurred" });
  }
};

const loadDashboard = async (req, res) => {
  if (req.session.admin) {
    try {
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error loading dashboard" });
    }
  } else {
    res.status(401).json({ success: false, message: "Not authenticated as admin" });
  }
};

const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.log("Error in logging out", err);
        return res.json({ success: false, message: "Error logging out" });
      }

      res.json({ success: true, message: "Logged out successfully" });
    });
  } catch (error) {
    console.log("Unexpected error occurred", error);
    res.json({ success: false, message: "An unexpected error occurred" });
  }
};

module.exports = { pageerror, loadLogin, getCurrentAdmin, login, loadDashboard, logout };
