
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
      enum: [
  "USER",
  "WALLET",
  "WITHDRAWAL",
  "PAYOUT_OPTION",
  "PAYOUT_METHOD"
],
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
// Find audit events linked to a withdrawal or transaction
auditLogSchema.index({ referenceId: 1 });

// Find audit activity affecting a particular user
auditLogSchema.index({ targetUserId: 1, createdAt: -1 });

// Find actions performed by a particular admin
auditLogSchema.index({ actorId: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
