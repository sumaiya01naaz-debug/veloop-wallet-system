
const mongoose = require("mongoose");

const walletTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    currency: {
      type: String,
      enum: ["VES", "SVES", "GEMS", "TOKENS", "SPINS"],
      required: true
    },

    type: {
      type: String,
      enum: ["CREDIT", "DEBIT"],
      required: true
    },

    amount: {
      type: Number,
      required: true,
      min: 0
    },

    balanceBefore: {
      type: Number,
      required: true
    },

    balanceAfter: {
      type: Number,
      required: true
    },

    source: {
      type: String,
      required: true
    },

    referenceId: {
      type: String
    },

    status: {
      type: String,
      enum: ["SUCCESS", "PENDING", "FAILED"],
      default: "SUCCESS"
    },

    description: {
      type: String,
      trim: true
    }
  },
  { timestamps: true }
);

walletTransactionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model(
  "WalletTransaction",
  walletTransactionSchema
);

