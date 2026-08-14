const profileService = require("./profile.service");
const { sendError } = require("../../shared/errors/respond");

// HTTP adapters for the signed-in account area. Rules live in
// profile.service.js.

const userProfile = async (req, res) => {
  try {
    const data = await profileService.getProfilePageData(req.session.user);
    return res.json({ success: true, ...data });
  } catch (error) {
    return sendError(res, error, "Error retrieving user profile data");
  }
};

const loadUserAddress = async (req, res) => {
  try {
    const data = await profileService.getAddressPageData(req.session.user);
    return res.json({ success: true, ...data });
  } catch (error) {
    return sendError(res, error, "Error retrieving user address data");
  }
};

const loadUserAccountDetails = async (req, res) => {
  try {
    const data = await profileService.getProfilePageData(req.session.user);
    return res.json({ success: true, ...data });
  } catch (error) {
    return sendError(res, error, "Error retrieving user account details");
  }
};

const loadUserOrder = async (req, res) => {
  try {
    const data = await profileService.getOrderHistory({
      userId: req.session.user,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || profileService.ORDERS_PER_PAGE,
    });
    return res.json({ success: true, ...data });
  } catch (error) {
    return sendError(res, error, "Error retrieving user orders");
  }
};

const updateProfileDetails = async (req, res) => {
  try {
    await profileService.updateProfileDetails({
      userId: req.session.user,
      name: req.body.name,
      phone: req.body.phone,
      password: req.body.password,
      newPassword: req.body.npassword,
    });
    return res.json({ success: true });
  } catch (error) {
    return sendError(res, error, "Error updating profile details");
  }
};

const validatCurrentPassword = async (req, res) => {
  try {
    const valid = await profileService.isCurrentPasswordValid({
      userId: req.session.user,
      password: req.body.password,
    });
    return res.json({ valid });
  } catch (error) {
    // This endpoint answers with `valid`, not `success` — the account form
    // polls it while typing, so keep the shape it expects on failure too.
    if (error.isAppError) {
      return res.status(error.status).json({ valid: false, message: error.message });
    }
    console.error("Error validating password:", error);
    return res.status(500).json({ valid: false, message: "Internal server error" });
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
