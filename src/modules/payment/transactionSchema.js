const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User ", 
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  type: {
    type: String,
    enum: ["credit", "debit"],
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  // The gateway payment this credit came from, when there was one.
  //
  // Unique + sparse so the same Razorpay payment can never be credited
  // twice: replaying a captured (orderId, paymentId, signature) triple
  // against /api/confirm-payment used to top the wallet up again on every
  // call, since nothing recorded that the payment had already been
  // settled. Sparse because refunds and order debits carry no paymentId.
  paymentId: {
    type: String,
    index: { unique: true, sparse: true },
  },
  date: {
    type: Date,
    default: Date.now,
  },
});


const Transaction = mongoose.model("Transaction", transactionSchema);

module.exports = Transaction;
