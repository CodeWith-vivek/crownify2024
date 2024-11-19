const mongoose = require("mongoose");
const { Schema } = mongoose;
const userSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/\S+@\S+\.\S+/, "Please enter a valid email address"],
  },
  phone: {
    type: String,
    required: false,
    unique: false,
    sparse: true,
    default: null,
  },
  lastLogin: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ["Active", "Inactive"],
    default: "Active", // Default status is Active
  },
  googleId: {
    type: String,
    unique: true,
  },
  password: {
    type: String,
    required: false,
  },
  isBlocked: {
    type: Boolean,
    default: false,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  cart: [
    {
      type: Schema.Types.ObjectId,
      ref: "Cart",
    },
  ],
  wallet: [
    {
      type: Number,
      default: 0,
    },
  ],
  orderHistory: [
    {
      type: Schema.Types.ObjectId,
      ref: "Order",
    },
  ],
  createdOn: {
    type: Date,
    default: Date.now,
  },
  referalCode: {
    type: String,
  },
  redeemed: {
    type: Boolean,
  },
  redeemedUsers: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  searchHistory: [
    {
      category: {
        type: Schema.Types.ObjectId,
        ref: "Category",
      },
      brand: {
        type: String,
      },
      searchedOn: {
        type: Date,
        default: Date.now,
      },
    },
  ],
});

const User = mongoose.model("User", userSchema);
module.exports = User;
