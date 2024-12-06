const mongoose = require("mongoose");
const Category = require("./categorySchema");
const { Schema } = mongoose;

// Subdocument schema for individual wishlist items
const wishlistItemSchema = new Schema({
  productId: {
    type: Schema.Types.ObjectId,
    ref: "Product", // Reference to the Product model
    required: true,
  },
  size: {
    type: String,
    enum: ["ONESIZE", "S / M", "M / L", "L / XL", "YOUTH"],
     // Size is mandatory
  },
  color: {
    type: String,
     // Color is mandatory
  },
  quantity: {
    type: Number,
    default: 1, // Default quantity is 1
    min: 1, // Quantity cannot be less than 1
  },
  productImage: {
    type: String,
    required: true,
  },
  category:{
    type:String,
    required:true
  },
  salePrice: {
    type: Number,
    required: true,
  },
  addedAt: {
    type: Date,
    default: Date.now, // Automatically records when the item is added
  },
  productDetails: {
    productName: {
      type: String,
      required: true,
    },
    productBrand: {
      type: String,
      required: true,
    },
  
    regularPrice: {
      type: Number,
      required: true,
    },
  },
});

// Main Wishlist schema
const wishlistSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User", // Reference to the User model
      required: true,
      unique: true, // Ensures one wishlist per user
    },
    items: [wishlistItemSchema],
    status: {
      type: String,
      enum: ["In Stock", "Out of Stock"],
      default: "In Stock",
    }, // Array of wishlist items
  },
  {
    timestamps: true,
  }
);

const Wishlist = mongoose.model("Wishlist", wishlistSchema);
module.exports = Wishlist;
