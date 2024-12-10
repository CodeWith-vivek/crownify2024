const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "Coupon code is required"],
      unique: true,
      trim: true,
      
    },
    discountType: {
      type: String,
      required: [true, "Discount type is required"],
      enum: ["percentage", "fixed"], // Allowed values: percentage, fixed
    },
    discountAmount: {
      type: Number,
      required: [true, "Discount amount is required"],
    
    },
    maxDiscount: {
      type: Number,
   
      default: null, // Optional field
    },
    minPurchase: {
      type: Number,
      required: [true, "Minimum purchase amount is required"],
     
    },
    expiryDate: {
      type: Date,
      required: [true, "Expiry date is required"],
    },
    usageLimit: {
      type: Number,
      required: [true, "Usage limit is required"],
      min: [0],
    },
   
    users_applied: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User", // Assumes your user model is named 'User'
        },
        used_count: {
          type: Number,
          default: 0,
          min: [0, "Used count cannot be negative"],
        },
      },
    ],
    description: {
      type: String,
      trim: true,
      
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true } // Automatically includes `createdAt` and `updatedAt` fields
);

// Automatically delete expired coupons
couponSchema.index({ expiryDate: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Coupon", couponSchema);
