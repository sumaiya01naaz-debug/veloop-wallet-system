
const mongoose = require("mongoose");

const payoutMethodSchema = new mongoose.Schema(
  {
    methodId: {
      type: String,
      required: true,
      unique: true
    },

    name: {
      type: String,
      required: true
    },

    description: String,

    active: {
      type: Boolean,
      default: true
    },

    available: {
      type: Boolean,
      default: true
    },

    badge: String,

    displayOrder: {
      type: Number,
      default: 0
    },

    unavailableReason: String
  },
  { timestamps: true }
);

module.exports = mongoose.model("PayoutMethod", payoutMethodSchema);
