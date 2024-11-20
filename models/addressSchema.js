const mongoose = require("mongoose");
const { Schema } = mongoose;

const addressSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User ",
      required: true,
    },
    addresses: [
      {
        addressType: {
          type: String,
          enum: ["Home", "Office", "Other"], // Specify common address types
          required: true,
        },
        fullName: {
          type: String,
          required: true,
          trim: true, // Combines first and last name
        },
        country: {
          type: String,
          required: true,
          trim: true,
        },
        mobileNumber: {
          type: String,
          required: true,
          trim: true,
        },
        postalCode: {
          type: String,
          required: true,
          trim: true,
        },
        flatHouseCompany: {
          type: String,
          required: true,
          trim: true, // Flat, House no., Company
        },
        areaStreet: {
          type: String,
          required: true,
          trim: true, // Area, Street
        },
        landmark: {
          type: String,
          trim: true, // Optional field
        },
        city: {
          type: String,
          required: true,
          trim: true, // Town / City
        },
        state: {
          type: String,
          required: true,
          trim: true, // State / Province
        },
        isPrimary: {
          type: Boolean,
          default: false, // Default is not primary
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true } // Adds createdAt and updatedAt timestamps
);

const Address = mongoose.model("Address", addressSchema);
module.exports = Address;
