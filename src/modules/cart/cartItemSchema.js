const mongoose =require("mongoose")
const {Schema}=mongoose

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
  orderStatus: {
    type: String,
    enum: ["Placed", "Shipped", "Delivered", "canceled","Return requested","Returned","Failed"],
    default: "Placed",
  },
  regularPrice: {
    type: Number,
    required: true,
  },
  returnRequest: {
    type: String,
    enum: ["Pending", "Approved", "Rejected"],
    default: "Pending",
  },

  returnComment: {
    type: String,
  },
  returnComments: {
    type: String,
  },
  salePrice: {
    type: Number,
    required: true,
  },
  totalPrice: {
    type: Number,
    required: true,
  },
  cancelComment: {
    type: String,

  },
  // When the item's status actually changed to Returned/canceled — distinct
  // from the order's orderedAt (when it was originally sold). Sales
  // reporting needs both: the original sale stays booked in the period it
  // happened, and the return is booked as a separate, negative entry in the
  // period it was actually processed, which can be a different month.
  returnedAt: {
    type: Date,
  },
  canceledAt: {
    type: Date,
  },
});


module.exports=cartItemSchema

