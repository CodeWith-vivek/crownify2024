const mongoose = require("mongoose");
const { Schema } = mongoose;

const cartItemSchema = require("../cart/cartItemSchema");
const orderSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    orderNumber: {
      type: String,
  
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
      enum: ["Pending", "Completed", "Failed", "Refunded","Partially Paid","Canceled"],
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
      required: true, 
    },
    total: {
      type: Number,
      required: true, 
    },
    shipping: {
      type: Number,
      default: 40.0,
    },
    grandTotal: {
      type: Number,
      required: true, 
    },
    // The Razorpay order this was last opened against — rewritten on each
    // retry so a later attempt can be traced back.
    razorpayOrderId: {
      type: String,
    },
    // Audit trail for the payment attempt: which gateway ids were
    // involved, when, and why it failed.
    //
    // Five separate places already wrote this object (order/payment.service
    // on success, on a bad signature and on a verification error;
    // payment/payment.service on a reported failure and on retry), but
    // neither this nor razorpayOrderId was declared here — so Mongoose's
    // strict mode silently discarded every one of those writes and no
    // payment history was ever persisted. Same class of bug as the
    // order.orderStatus write noted in adminOrders.service.js.
    paymentDetails: {
      paymentId: { type: String },
      razorpayOrderId: { type: String },
      razorpayPaymentId: { type: String },
      paymentStatus: { type: String },
      failureReason: { type: String },
      failureDescription: { type: String },
      paymentDate: { type: Date },
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
