
const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    action: {
      type: String,
      required: true
    },

    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    targetType: {
      type: String,
      enum: ["USER", "WALLET", "WITHDRAWAL", "PAYOUT_OPTION"],
      required: true
    },

    referenceId: {
      type: String
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed
    },

    ipAddress: String
  },
  { timestamps: true }
);

auditLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
