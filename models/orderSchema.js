const mongoose = require("mongoose");
const { Schema } = mongoose;

const cartItemSchema = require("../models/cartItemSchema");
const orderSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    orderNumber: {
      type: String,
      required: true,
      unique: true,
    },
    items: [cartItemSchema],
    shippingAddress: {
      type: Schema.Types.ObjectId,
      ref: "Address",
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ["COD", "Card", "UPI", "Wallet", "Net Banking", "RazorPay"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Completed", "Failed", "Refunded","Partially Paid"],
      default: "Pending",
    },
    coupon: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon" },
    couponCode: { type: String, default: null },
    discount: {
      type: Number,
      default: 0,
    },
    subtotal: {
      type: Number,
      required: true, // Add this to ensure subtotal is always saved
    },
    total: {
      type: Number,
      required: true, // Total before discount
    },
    shipping: {
      type: Number,
      default: 40.0,
    },
    grandTotal: {
      type: Number,
      required: true, // Total after discount + shipping
    },
    orderedAt: {
      type: Date,
      default: Date.now,
    },
    deliveredAt: {
      type: Date,
    },
    trackingId: {
      type: String,
    },
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
