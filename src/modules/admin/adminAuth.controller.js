const adminAuthService = require("./adminAuth.service");

// HTTP adapters for the admin session. Rules live in adminAuth.service.js;
// the session is written here.

const pageerror = async (req, res) => {
  res.json({ success: true });
};

const loadLogin = (req, res) => {
  if (req.session.admin) {
    return res.json({ success: true, redirect: "/admin/dashboard" });
  }
  return res.json({ success: true, admin: false });
};

// Lets the admin SPA hydrate its auth state on load/refresh.
const getCurrentAdmin = (req, res) => {
  res.json({ success: true, admin: !!req.session.admin });
};

const login = async (req, res) => {
  try {
    const { ok, message, redirectUrl, session } = await adminAuthService.login({
      email: req.body.email,
      password: req.body.password,
    });

    if (!ok) return res.json({ success: false, message });

    Object.assign(req.session, session);

    return res.json({ success: true, message, redirectUrl });
  } catch (error) {
    console.error("Admin login error:", error);
    // Answered as 200 for the same reason a rejected login is: a 401 here
    // triggers the client's unauthorized handler on the login page itself.
    return res.json({ success: false, message: "An error occurred" });
  }
};

// Reached only through adminAuth, so arriving here IS the success case.
const loadDashboard = async (req, res) => {
  res.json({ success: true });
};

const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.log("Error in logging out", err);
        return res.json({ success: false, message: "Error logging out" });
      }
      return res.json({ success: true, message: "Logged out successfully" });
    });
  } catch (error) {
    console.log("Unexpected error occurred", error);
    return res.json({ success: false, message: "An unexpected error occurred" });
  }
};

module.exports = { pageerror, loadLogin, getCurrentAdmin, login, loadDashboard, logout };
