const mongoose = require("mongoose");

const { Schema } = mongoose;


const wishlistItemSchema = new Schema({
  productId: {
    type: Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  size: {
    type: String,
    enum: ["ONESIZE", "S / M", "M / L", "L / XL", "YOUTH"],
     
  },
  color: {
    type: String,
  
  },
  quantity: {
    type: Number,
    default: 1, 
    min: 1,
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
    default: Date.now, 
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


const wishlistSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User", 
      required: true,
      unique: true,
    },
    items: [wishlistItemSchema],
    status: {
      type: String,
      enum: ["In Stock", "Out of Stock"],
      default: "In Stock",
    }, 
  },
  {
    timestamps: true,
  }
);

const Wishlist = mongoose.model("Wishlist", wishlistSchema);
module.exports = Wishlist;
