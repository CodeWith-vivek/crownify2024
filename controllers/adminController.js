const User = require("../models/userSchema");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { session } = require("passport");
const pageerror = async (req, res) => {
  res.render("admin-error");
};
const loadLogin = (req, res) => {
  if (req.session.admin) {
    return res.redirect("/admin/dashboard");
  }
  res.render("admin-login", { message: null });
};
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await User.findOne({ email, isAdmin: true });

    if (admin) {
      const passwordMatch = await bcrypt.compare(password, admin.password);
      if (passwordMatch) {
        req.session.admin = true; // Set session for the logged-in admin

        // Return success response with redirect URL
        return res.json({
          success: true,
          message: "Login Successful",
          redirectUrl: "/admin/dashboard",
        });
      } else {
        return res.json({ success: false, message: "Invalid Password" }); // Return error response
      }
    } else {
      return res.json({ success: false, message: "You are not Admin !" }); // Return error response
    }
  } catch (error) {
    console.error("Login error:", error);
    return res.json({ success: false, message: "An error occurred" }); // Return error response
  }
};
const loadDashboard = async (req, res) => {
  if (req.session.admin) {
    try {
      res.render("dashboard"); // Render the admin dashboard
    } catch (error) {
      res.redirect("/admin/pageerror");
    }
  } else {
    res.redirect("/admin/login"); // Redirect to login if not logged in
  }
};

// to load
const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.log("Error destroying session");
        return res.json({ success: false, message: "Error logging out" });
      }

      // Send success response instead of redirecting
      res.json({ success: true, message: "Logged out successfully" });
    });
  } catch (error) {
    console.log("Unexpected error occurred", error);
    res.json({ success: false, message: "An unexpected error occurred" });
  }
};
module.exports = {
  loadLogin,
  login,
  loadDashboard,
  pageerror,
  logout,
};
