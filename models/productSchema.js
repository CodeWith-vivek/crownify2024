const mongoose = require("mongoose");
const { Schema } = mongoose;

const productVariantSchema = new Schema({
  color: {
    type: String,
    required: true, 
  },
  size: {
    type: String,
    enum: ["ONESIZE", "S / M", "M / L", "L / XL", "YOUTH"],
    required: true, 
  },
  quantity: {
    type: Number,
    required: true, 
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
      required: true, 
    },
    variants: [productVariantSchema], 
    isBlocked: {
      type: Boolean,
      default: false,
    },
  
  },
  { timestamps: true }
);

const Product = mongoose.model("Product", productSchema);
module.exports = Product;
