const mongoose = require("mongoose");
const { Schema } = mongoose;

const orderItemSchema = new Schema({
  productId: {
    type: Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  productName: {
    type: String,
    required: true,
  },
  variant: {
    color: {
      type: String,
      required: true,
    },
    size: {
      type: String,
      enum: ["ONESIZE", "S / M", "M / L", "L / XL", "YOUTH"],
      required: true,
    },
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  productImage: {
    type: String,
    required: true,
  },
  salePrice: {
    type: Number,
    required: true,
  },
  totalPrice: {
    type: Number,
    required: true,
  },
});

const orderSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [orderItemSchema], // List of ordered items
    shippingAddress: {
      type: Schema.Types.ObjectId,
      ref: "Address",
      required: true, // Links to the primary address of the user
    },
    paymentMethod: {
      type: String,
      enum: ["COD", "Card", "UPI", "Wallet", "Net Banking"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Completed", "Failed", "Refunded"],
      default: "Pending",
    },
    orderStatus: {
      type: String,
      enum: [
        "Placed",
        "Confirmed",
        "Shipped",
        "Delivered",
        "Cancelled",
        "Returned",
      ],
      default: "Placed",
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    discount: {
      type: Number,
      default: 0,
    },
    shippingCharge: {
      type: Number,
      default: 40.0,
    },
    grandTotal: {
      type: Number,
      required: true, // totalAmount - discount + shippingCharge
    },
    orderedAt: {
      type: Date,
      default: Date.now,
    },
    deliveredAt: {
      type: Date, // Updates when the order is marked as delivered
    },
    trackingId: {
      type: String, // Optional field for order tracking
    },
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
