const mongoose = require("mongoose");
const { Schema } = mongoose;

const cartItemSchema = new Schema({
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
    default: 1,
  },
  productImage: {
    type: String,
    required: true,
  },
  regularPrice: {
    type: Number,
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
