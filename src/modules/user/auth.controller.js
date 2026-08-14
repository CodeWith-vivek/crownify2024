const authService = require("./auth.service");
const { sendError } = require("../../shared/errors/respond");

// HTTP adapters for the session lifecycle. Rules live in auth.service.js;
// this file owns the session, which the service cannot touch.

const getCurrentUser = async (req, res) => {
  try {
    const { destroySession, ...result } = await authService.getCurrentUser(req.session.user);

    // The session points at an account that has since been deleted or
    // blocked — tear it down rather than leaving it to 401 on every call.
    if (destroySession) req.session.destroy(() => {});

    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error fetching current user");
  }
};

const loadLogin = async (req, res) => {
  try {
    const result = await authService.getLoginPageData(req.session.user);
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error loading login page");
  }
};

const login = async (req, res) => {
  try {
    const { ok, message, redirectUrl, session } = await authService.login({
      email: req.body.email,
      password: req.body.password,
    });

    if (!ok) return res.json({ success: false, message });

    Object.assign(req.session, session);

    return res.json({ success: true, message, redirectUrl });
  } catch (error) {
    console.error("Login error:", error);
    // Answered as 200 for the same reason a rejected login is: a 401 here
    // triggers the client's unauthorized handler on the login page itself.
    return res.json({ success: false, message: "An error occurred during login" });
  }
};

const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.log("session logout error", err);
        return res.status(500).json({ success: false, message: "Logout failed" });
      }
      return res.json({ success: true });
    });
  } catch (error) {
    console.log("logout error", error);
    return res.status(500).json({ success: false, message: "Logout failed" });
  }
};

module.exports = { getCurrentUser, loadLogin, login, logout };
