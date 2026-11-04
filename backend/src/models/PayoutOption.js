
const mongoose = require("mongoose");

const payoutOptionSchema = new mongoose.Schema(
  {
    optionId: {
      type: String,
      required: true,
      unique: true
    },

    method: {
      type: String,
      required: true,
      enum: ["upi", "amazon_pay", "google_play", "paypal"]
    },

    payoutAmount: {
      type: Number,
      required: true,
      min: 1
    },

    payoutCurrency: {
      type: String,
      default: "INR"
    },

    requiredCurrency: {
      type: String,
      default: "VES",
      enum: ["VES"]
    },

    requiredAmount: {
      type: Number,
      required: true,
      min: 1
    },

    active: {
      type: Boolean,
      default: true
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed
    }
  },
  { timestamps: true }
);

payoutOptionSchema.index({ method: 1, active: 1 });

module.exports = mongoose.model("PayoutOption", payoutOptionSchema);

