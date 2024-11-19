const mongoose = require("mongoose");
const { Schema } = mongoose;

const productVariantSchema = new Schema({
  color: {
    type: String,
    required: true, // Color is now an individual property of each variant
  },
  size: {
    type: String,
    enum: ["ONESIZE", "S / M", "M / L", "L / XL", "YOUTH"],
    required: true, // Size is now an individual property of each variant
  },
  quantity: {
    type: Number,
    required: true, // Quantity for each color-size combination
    default: 1,
  },
});

const productSchema = new Schema(
  {
    productName: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    brand: {
      type: String,
      required: true,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
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
    productOffer: {
      type: Number,
      default: 0,
    },
    productImage: {
      type: [String],
      required: true, // Multiple images can still be stored
    },
    variants: [productVariantSchema], // Add an array for storing multiple variants
    isBlocked: {
      type: Boolean,
      default: false,
    },
    // status: {
    //   type: String,
    //   enum: ["In Stock", "out of stock", "Discontinued"],
    //   required: true,
    //   default: "In Stock",
    // },
  },
  { timestamps: true }
);

const Product = mongoose.model("Product", productSchema);
module.exports = Product;
