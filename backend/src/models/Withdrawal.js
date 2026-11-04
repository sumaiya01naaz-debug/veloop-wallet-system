
const mongoose = require("mongoose");

const withdrawalSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    method: {
      type: String,
      required: true
    },

    optionId: {
      type: String,
      required: true
    },

    currency: {
      type: String,
      default: "VES",
      enum: ["VES"]
    },

    currencyAmount: {
      type: Number,
      required: true,
      min: 1
    },

    payoutAmount: {
      type: Number,
      required: true,
      min: 1
    },

    payoutDetails: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },

    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "APPROVED", "REJECTED", "CANCELLED"],
      default: "PENDING"
    },

    rejectionReason: String,

    reviewNote: String,

    idempotencyKey: {
      type: String,
      required: true
    },

    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WalletTransaction"
    },

    requestedAt: {
      type: Date,
      default: Date.now
    },

    processedAt: Date
  },
  { timestamps: true }
);

withdrawalSchema.index(
  { userId: 1, idempotencyKey: 1 },
  { unique: true }
);

module.exports = mongoose.model("Withdrawal", withdrawalSchema);
