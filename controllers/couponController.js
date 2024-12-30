const Coupon = require("../models/couponSchema");


//code to load coupon management page

const loadCouponManagement = async (req, res) => {
  if (req.session.admin) {
    try {
      const coupons = await Coupon.find({}).sort({ createdAt: -1 });
      res.render("couponManagement", { coupons });
    } catch (error) {
      console.error("Error loading coupon management page:", error.message);
      res.redirect("/admin/pageerror");
    }
  } else {
    res.redirect("/admin/login");
  }
};


//code to get coupons

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

//code to add coupon

const addCoupon = async (req, res) => {
  if (!req.session.admin) {
    return res
      .status(401)
      .json({ success: false, message: "Unauthorized access" });
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

//code to delete the coupon

const deleteCoupon = async (req, res) => {
  if (req.session.admin) {
    try {
      const { id } = req.params;

      const coupon = await Coupon.findByIdAndDelete(id);
      if (!coupon) {
        return res
          .status(404)
          .json({ success: false, message: "Coupon not found" });
      }

      res.json({ success: true, message: "Coupon deleted successfully!" });
    } catch (error) {
      console.error("Error deleting coupon:", error.message);
      res
        .status(500)
        .json({ success: false, message: "Failed to delete coupon." });
    }
  } else {
    res.status(401).json({ success: false, message: "Unauthorized" });
  }
};

//code to edit coupon

const editCoupon = async (req, res) => {
 try {
   const couponId = req.params.id;

  
   const coupon = await Coupon.findById(couponId);

   if (!coupon) {
     return res.status(404).send("Coupon not found");
   }

  
   res.render("editCoupon", { coupon });
 } catch (error) {
   console.error("Error fetching coupon:", error.message);
   res.status(500).send("Server error");
 }
};

//code to update the coupon

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
//code to apply coupon

const couponApply = async (req, res) => {
  const { couponCode, cartTotal } = req.body;
  const userId = req.session.user;

  try {
 
    if (!couponCode || !cartTotal || cartTotal <= 0) {
      req.session.coupon = null;
      return res
        .status(400)
        .json({ success: false, message: "Invalid input." });
    }

  
    const coupon = await Coupon.findOne({ code: couponCode, isActive: true });
    if (!coupon) {
      req.session.coupon = null;
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired coupon." });
    }


    if (new Date() > coupon.expiryDate) {
      req.session.coupon = null;
      return res
        .status(400)
        .json({ success: false, message: "This coupon has expired." });
    }

   
    if (cartTotal < coupon.minPurchase) {
      req.session.coupon = null;
      return res.status(400).json({
        success: false,
        message: `Minimum purchase required is ₹${coupon.minPurchase}.`,
      });
    }

   
    if (!Array.isArray(coupon.users_applied)) {
      coupon.users_applied = [];
    }

    
    const userEntry = coupon.users_applied.find(
      (entry) => entry.user && entry.user.toString() === userId.toString()
    );

 
    if (
      coupon.usageLimit !== 0 &&
      userEntry &&
      userEntry.used_count >= coupon.usageLimit
    ) {
      return res.status(400).json({
        success: false,
        message: "You have reached the usage limit for this coupon.",
      });
    }


    let discount = 0;
    if (coupon.discountType === "percentage") {
      discount = Math.floor((cartTotal * coupon.discountAmount) / 100);
      discount = Math.min(discount, coupon.maxDiscount || discount);
    } else if (coupon.discountType === "fixed") {
      discount = Math.floor(coupon.discountAmount);
    }

   
    const finalTotal = Math.floor(Math.max(0, cartTotal - discount));


    req.session.coupon = {
      code: coupon.code,
      discount: {
        originalAmount: coupon.discountAmount,
        calculatedAmount: discount,
        type: coupon.discountType,
      },
      maxDiscount: coupon.maxDiscount,
      cartTotal,
      userId,
      temporary: true, 
    };


    return res.status(200).json({
      success: true,
      discount: { percentageOrFixed: coupon.discountAmount, applied: discount },
      finalTotal,
    });
  } catch (err) {
    console.error("Error in couponApply:", err);
    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
};

//code to remove coupon

const removeCoupon = async (req, res) => {
  const { cartTotal } = req.body; 
 
  

  try {

    if (cartTotal < 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid input.",
      });
    }

 
    req.session.coupon = null;

   
    return res.status(200).json({
      success: true,
      message: "Coupon removed successfully.",
      discount: 0,
      finalTotal: cartTotal, 
    });
  } catch (err) {
    console.error("Error removing coupon:", err);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while removing the coupon.",
    });
  }
};
module.exports = {
  loadCouponManagement,
  getCoupons,
  addCoupon,
  deleteCoupon,
  editCoupon,
  updateCoupon,
  couponApply,
  removeCoupon
}
