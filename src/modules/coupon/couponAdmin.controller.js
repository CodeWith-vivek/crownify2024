const couponService = require("./coupon.service");
const { sendError } = require("../../shared/errors/respond");

// HTTP adapters for admin coupon CRUD. Rules live in coupon.service.js.
//
// Every route here is behind adminAuth, so the `if (req.session.admin)`
// wrapper each of these handlers used to carry was unreachable.

const loadCouponManagement = async (req, res) => {
  try {
    return res.json({ success: true, coupons: await couponService.listCoupons() });
  } catch (error) {
    return sendError(res, error, "Error loading coupon management page");
  }
};

const getCoupons = async (req, res) => {
  try {
    // Answers with a bare array, not an envelope — the admin coupon table
    // consumes it directly.
    return res.json(await couponService.listCoupons());
  } catch (error) {
    console.error("Error fetching coupons:", error);
    return res.status(500).json({ error: "Failed to fetch coupons" });
  }
};

const addCoupon = async (req, res) => {
  try {
    const result = await couponService.createCoupon(req.body);
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error adding coupon");
  }
};

const deleteCoupon = async (req, res) => {
  try {
    const result = await couponService.deleteCoupon(req.params.id);
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error deleting coupon");
  }
};

const editCoupon = async (req, res) => {
  try {
    const coupon = await couponService.getCoupon(req.params.id);
    return res.json({ success: true, coupon });
  } catch (error) {
    return sendError(res, error, "Error fetching coupon");
  }
};

const updateCoupon = async (req, res) => {
  try {
    const result = await couponService.updateCoupon({
      couponId: req.params.id,
      body: req.body,
    });
    return res.json(result);
  } catch (error) {
    return sendError(res, error, "Error updating coupon");
  }
};

module.exports = {
  loadCouponManagement,
  getCoupons,
  addCoupon,
  deleteCoupon,
  editCoupon,
  updateCoupon,
};
