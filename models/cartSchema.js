const mongoose = require("mongoose");
const { Schema } = mongoose;
const cartItemSchema = require("../models/cartItemSchema")


const cartSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [cartItemSchema],
    cartSummary: {
      subtotal: {
        type: Number,
        default: 0,
      },
      shippingCharge: {
        type: Number,
        default: 40.0,
      },
      total: {
        type: Number,
        default: 0,
      },
      discount: {
        type: Number,
        default: 0,
      },
    },
    status: {
      type: String,
      enum: ["In Stock", "Out of Stock",],
      default: "In Stock",
    },
  },
  {
    timestamps: true,
  }
);
const Cart = mongoose.model("Cart", cartSchema);
module.exports = Cart;
