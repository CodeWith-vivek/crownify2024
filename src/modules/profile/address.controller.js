const addressService = require("./address.service");
const { sendError } = require("../../shared/errors/respond");

// HTTP adapters for saved shipping addresses. Rules live in
// address.service.js.

const loadAddAddressPage = async (req, res) => {
  try {
    const data = await addressService.getAddAddressPageData(req.session.user);
    return res.json({ success: true, ...data });
  } catch (error) {
    return sendError(res, error, "Error loading add address page");
  }
};

const addAddress = async (req, res) => {
  try {
    const address = await addressService.addAddress({
      userId: req.session.user,
      body: req.body,
    });
    return res.status(201).json({ message: "Address added successfully!", data: address });
  } catch (error) {
    return sendError(res, error, "Error adding address");
  }
};

const setPrimaryAddress = async (req, res) => {
  try {
    const result = await addressService.setPrimaryAddress({
      userId: req.session.user,
      addressId: req.params.id,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error setting primary address");
  }
};

const deleteUserAddress = async (req, res) => {
  try {
    const result = await addressService.deleteAddress({
      userId: req.session.user,
      addressId: req.params.id,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error deleting address");
  }
};

const editUserAddress = async (req, res) => {
  try {
    const data = await addressService.getEditAddressData({
      userId: req.session.user,
      addressId: req.params.id,
    });
    return res.json({ success: true, ...data });
  } catch (error) {
    return sendError(res, error, "Edit Address Error");
  }
};

const updateUserAddress = async (req, res) => {
  try {
    const result = await addressService.updateAddress({
      userId: req.session.user,
      addressId: req.params.id,
      body: req.body,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Update Address Error");
  }
};

module.exports = {
  loadAddAddressPage,
  addAddress,
  setPrimaryAddress,
  deleteUserAddress,
  editUserAddress,
  updateUserAddress,
};
