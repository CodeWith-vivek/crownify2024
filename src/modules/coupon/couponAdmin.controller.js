const Coupon = require("./couponSchema");

// Admin-side coupon CRUD. Customer-facing apply/remove lives in
// couponApply.controller.js.

const loadCouponManagement = async (req, res) => {
  if (req.session.admin) {
    try {
      const coupons = await Coupon.find({}).sort({ createdAt: -1 });
      res.json({ success: true, coupons });
    } catch (error) {
      console.error("Error loading coupon management page:", error.message);
      res.status(500).json({ success: false, message: "Error loading coupons" });
    }
  } else {
    res.status(401).json({ success: false, message: "Not authenticated as admin" });
  }
};

const getCoupons = async (req, res) => {
  if (req.session.admin) {
    try {
      const coupons = await Coupon.find({}).sort({ createdAt: -1 });
      res.json(coupons);
    } catch (error) {
      console.error("Error fetching coupons:", error.message);
      res.status(500).json({ error: "Failed to fetch coupons" });
    }
  } else {
    res.status(401).json({ error: "Unauthorized" });
  }
};

const addCoupon = async (req, res) => {
  if (!req.session.admin) {
    return res.status(401).json({ success: false, message: "Unauthorized access" });
  }

  try {
    const {
      code,
      discountType,
      discountAmount,
      maxDiscount,
      minPurchase,
      expiryDate,
      usageLimit,
      description,
    } = req.body;

    const existingCoupon = await Coupon.findOne({ code });
    if (existingCoupon) {
      return res.status(400).json({
        success: false,
        message: "Coupon code already exists",
      });
    }

    // 0 means unlimited; anything below that is meaningless.
    if (usageLimit < 0) {
      return res.status(400).json({
        success: false,
        message: "Usage limit must be 0 or greater.",
      });
    }

    const newCoupon = new Coupon({
      code,
      discountType,
      discountAmount: Number(discountAmount),
      maxDiscount: Number(maxDiscount),
      minPurchase: Number(minPurchase),
      expiryDate: new Date(expiryDate),
      usageLimit: Number(usageLimit),
      description: description ? description.trim() : undefined,
    });

    await newCoupon.save();
    res.json({
      success: true,
      message: "Coupon added successfully!",
      coupon: newCoupon,
    });
  } catch (error) {
    console.error("Error adding coupon:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to add coupon. " + error.message,
    });
  }
};

const deleteCoupon = async (req, res) => {
  if (req.session.admin) {
    try {
      const { id } = req.params;

      const coupon = await Coupon.findByIdAndDelete(id);
      if (!coupon) {
        return res.status(404).json({ success: false, message: "Coupon not found" });
      }

      res.json({ success: true, message: "Coupon deleted successfully!" });
    } catch (error) {
      console.error("Error deleting coupon:", error.message);
      res.status(500).json({ success: false, message: "Failed to delete coupon." });
    }
  } else {
    res.status(401).json({ success: false, message: "Unauthorized" });
  }
};

const editCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;

    const coupon = await Coupon.findById(couponId);

    if (!coupon) {
      return res.status(404).json({ success: false, message: "Coupon not found" });
    }

    res.json({ success: true, coupon });
  } catch (error) {
    console.error("Error fetching coupon:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const updateCoupon = async (req, res) => {
  const couponId = req.params.id;
  const {
    couponCode,
    discountType,
    discountAmount,
    maxDiscount,
    minPurchase,
    expiryDate,
    usageLimit,
    description,
  } = req.body;

  try {
    const updatedCoupon = await Coupon.findByIdAndUpdate(
      couponId,
      {
        code: couponCode,
        discountType,
        discountAmount,
        maxDiscount,
        minPurchase,
        expiryDate,
        usageLimit,
        description,
      },
      { new: true, runValidators: true }
    );

    if (!updatedCoupon) {
      console.error("Coupon not found with ID:", couponId);
      return res.status(404).json({ message: "Coupon not found" });
    }

    res.json({ message: "Coupon updated successfully" });
  } catch (error) {
    console.error("Error updating coupon:", error);
    res.status(500).json({ message: "Server error" });
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
