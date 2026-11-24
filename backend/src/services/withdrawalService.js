
const mongoose = require("mongoose");

const User = require("../models/User");
const Wallet = require("../models/Wallet");
const Withdrawal = require("../models/Withdrawal");
const WalletTransaction = require("../models/WalletTransaction");
const PayoutMethod = require("../models/PayoutMethod");
const PayoutOption = require("../models/PayoutOption");
const AuditLog = require("../models/AuditLog");

const createWithdrawal = async ({
  userId,
  method,
  optionId,
  payoutDetails,
  idempotencyKey,
  ipAddress
}) => {
  // Check required fields
  // Validate user ID
if (!mongoose.isValidObjectId(userId)) {
  throw Object.assign(
    new Error("Invalid user ID."),
    { statusCode: 400 }
  );
}

// Validate payout method
if (typeof method !== "string" || !method.trim()) {
  throw Object.assign(
    new Error("Valid payout method is required."),
    { statusCode: 400 }
  );
}

method = method.trim().toLowerCase();

if (method !== "upi") {
  throw Object.assign(
    new Error("This payout method is not yet configured."),
    { statusCode: 400 }
  );
}

// Validate payout option ID
if (
  typeof optionId !== "string" ||
  !optionId.trim() ||
  optionId.trim().length > 100
) {
  throw Object.assign(
    new Error("Invalid payout option ID."),
    { statusCode: 400 }
  );
}

optionId = optionId.trim();

// Validate idempotency key
if (
  typeof idempotencyKey !== "string" ||
  !idempotencyKey.trim() ||
  idempotencyKey.trim().length > 128
) {
  throw Object.assign(
    new Error("Invalid idempotency key."),
    { statusCode: 400 }
  );
}

idempotencyKey = idempotencyKey.trim();

// Validate payout details
if (
  !payoutDetails ||
  typeof payoutDetails !== "object" ||
  Array.isArray(payoutDetails)
) {
  throw Object.assign(
    new Error("Valid payout details are required."),
    { statusCode: 400 }
  );
}

// Validate UPI ID
if (
  typeof payoutDetails.upiId !== "string" ||
  !payoutDetails.upiId.trim() ||
  payoutDetails.upiId.trim().length > 100 ||
  !/^[\w.-]+@[A-Za-z0-9.-]+$/.test(
    payoutDetails.upiId.trim()
  )
) {
  throw Object.assign(
    new Error("Please provide a valid UPI ID."),
    { statusCode: 400 }
  );
}

const upiId = payoutDetails.upiId.trim();

  // Check duplicate request
  const existing = await Withdrawal.findOne({
    userId,
    idempotencyKey
  });

  if (existing) {
    return existing;
  }

  // Check user account
  const user = await User.findById(userId);

  if (!user || user.accountStatus !== "ACTIVE") {
    throw Object.assign(
      new Error("User account is unavailable."),
      { statusCode: 403 }
    );
  }

  // Find selected payout method
  const methodData = await PayoutMethod.findOne({
    methodId: method,
    active: true,
    available: true
  });

  if (!methodData) {
    throw Object.assign(
      new Error("Payout method is unavailable."),
      { statusCode: 400 }
    );
  }

  // Find voucher from database
  const option = await PayoutOption.findOne({
    optionId,
    method,
    active: true
  });

  if (!option) {
    throw Object.assign(
      new Error("Invalid payout option."),
      { statusCode: 400 }
    );
  }

  const session = await mongoose.startSession();

  try {
    let withdrawal;

    await session.withTransaction(async () => {
     const tenMinutesAgo = new Date(
  Date.now() - 10 * 60 * 1000
);

const recentRequestCount = await Withdrawal.countDocuments({
  userId,
  createdAt: { $gte: tenMinutesAgo }
}).session(session);

// The third or subsequent request within 10 minutes
// requires manual review.
const riskReviewRequired = recentRequestCount >= 2;
      // Deduct VEs only if sufficient balance exists
      const wallet = await Wallet.findOneAndUpdate(
        {
          userId,
          ves: { $gte: option.requiredAmount }
        },
        {
          $inc: { ves: -option.requiredAmount }
        },
        {
          returnDocument: "after",
          session,
          runValidators: true
        }
      );

      if (!wallet) {
        const exists = await Wallet.exists({ userId }).session(session);

        if (!exists) {
          throw Object.assign(
            new Error("Wallet not found."),
            { statusCode: 404 }
          );
        }

        throw Object.assign(
          new Error("Insufficient VEs balance."),
          { statusCode: 400 }
        );
      }

      const balanceAfter = wallet.ves;
      const balanceBefore = balanceAfter + option.requiredAmount;

      // Create withdrawal record
      const [newWithdrawal] = await Withdrawal.create(
        [{
          userId,
          method,
          optionId,
          currency: "VES",
          currencyAmount: option.requiredAmount,
          payoutAmount: option.payoutAmount,
          payoutDetails: { upiId },
          status: riskReviewRequired ? "PROCESSING" : "PENDING",
riskReviewRequired,
riskReason: riskReviewRequired
  ? "Multiple withdrawal requests within 10 minutes."
  : null,
idempotencyKey
        }],
        { session }
      );

      // Create corresponding ledger record
      const [ledger] = await WalletTransaction.create(
        [{
          userId,
          currency: "VES",
          type: "DEBIT",
          amount: option.requiredAmount,
          balanceBefore,
          balanceAfter,
          source: "WITHDRAWAL",
          referenceId: newWithdrawal._id.toString(),
          description: `UPI withdrawal - Rs. ${option.payoutAmount}`,
          status: "SUCCESS"
        }],
        { session }
      );

      // Link ledger to withdrawal
      newWithdrawal.transactionId = ledger._id;
await newWithdrawal.save({ session });

// Audit withdrawal creation
await AuditLog.create(
  [{
    actorId: userId,
    action: "WITHDRAWAL_CREATED",
    targetUserId: userId,
    targetType: "WITHDRAWAL",
    referenceId: newWithdrawal._id.toString(),
    metadata: {
      method,
      optionId,
      currency: "VES",
      currencyAmount: option.requiredAmount,
      payoutAmount: option.payoutAmount
    },
    ipAddress
  }],
  { session }
);

// ADD THIS CODE HERE
if (riskReviewRequired) {
  await AuditLog.create(
    [{
      actorId: userId,
      action: "SUSPICIOUS_ACTIVITY_DETECTED",
      targetUserId: userId,
      targetType: "WITHDRAWAL",
      referenceId: newWithdrawal._id.toString(),
      metadata: {
        reason: "Multiple withdrawal requests within 10 minutes.",
        recentRequestCount: recentRequestCount + 1,
        reviewRequired: true
      },
      ipAddress
    }],
    { session }
  );
}

withdrawal = newWithdrawal;
    });

    return withdrawal;

  } catch (error) {

    // Handle simultaneous duplicate requests
    if (error.code === 11000) {
      const existing = await Withdrawal.findOne({
        userId,
        idempotencyKey
      });

      if (existing) return existing;
    }

    throw error;

  } finally {
    await session.endSession();
  }
};


const processWithdrawal = async ({
  withdrawalId,
  adminId,
  action,
  rejectionReason,
  reviewNote
}) => {
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const withdrawal = await Withdrawal.findById(withdrawalId)
        .session(session);

      if (!withdrawal) {
  throw Object.assign(
    new Error("Withdrawal not found."),
    { statusCode: 404 }
  );
}

if (!["PENDING", "PROCESSING"].includes(withdrawal.status)) {
  throw Object.assign(
    new Error("Withdrawal has already been processed."),
    { statusCode: 409 }
  );
}

      if (action === "REJECT" && !rejectionReason?.trim()) {
        throw new Error("Rejection reason is required.");
      }

      const newStatus = action === "APPROVE"
        ? "APPROVED"
        : "REJECTED";

      // Update withdrawal status
      const updated = await Withdrawal.findOneAndUpdate(
        {
          _id: withdrawalId,
          status: { $in: ["PENDING", "PROCESSING"] }
        },
        {
          $set: {
            status: newStatus,
            rejectionReason: action === "REJECT"
              ? rejectionReason.trim()
              : undefined,
            reviewNote: reviewNote || "",
            processedAt: new Date()
          }
        },
        {
          session,
          returnDocument: "after"
        }
      );

      if (!updated) {
  throw Object.assign(
    new Error("Withdrawal has already been processed."),
    { statusCode: 409 }
  );
}

      // Refund VEs when withdrawal is rejected
      if (action === "REJECT") {
        const wallet = await Wallet.findOneAndUpdate(
          { userId: withdrawal.userId },
          {
            $inc: {
              ves: withdrawal.currencyAmount
            }
          },
          {
            session,
            returnDocument: "after",
            runValidators: true
          }
        );

        if (!wallet) {
          throw new Error("Wallet not found. Refund cancelled.");
        }

        const balanceAfter = wallet.ves;
        const balanceBefore = balanceAfter - withdrawal.currencyAmount;

        // Create refund ledger entry
        await WalletTransaction.create(
          [{
            userId: withdrawal.userId,
            currency: "VES",
            type: "CREDIT",
            amount: withdrawal.currencyAmount,
            balanceBefore,
            balanceAfter,
            source: "WITHDRAWAL_REFUND",
            referenceId: withdrawal._id.toString(),
            status: "SUCCESS",
            description: "Refund for rejected withdrawal"
          }],
          { session }
        );
      }

      // Record sensitive admin action
      await AuditLog.create(
        [{
          actorId: adminId,
          action: action === "APPROVE"
            ? "WITHDRAWAL_APPROVED"
            : "WITHDRAWAL_REJECTED",
          targetUserId: withdrawal.userId,
          targetType: "WITHDRAWAL",
          referenceId: withdrawal._id.toString(),
          metadata: {
            rejectionReason: rejectionReason || null,
            reviewNote: reviewNote || null
          }
        }],
        { session }
      );

      result = updated;
    });

    return result;

  } finally {
    await session.endSession();
  }
};

const approveWithdrawal = (data) =>
  processWithdrawal({ ...data, action: "APPROVE" });

const rejectWithdrawal = (data) =>
  processWithdrawal({ ...data, action: "REJECT" });

const markWithdrawalProcessing = async ({
  withdrawalId,
  adminId,
  reviewNote,
  ipAddress
}) => {
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const withdrawal = await Withdrawal.findOneAndUpdate(
        {
          _id: withdrawalId,
          status: "PENDING"
        },
        {
          $set: {
            status: "PROCESSING",
            reviewNote: reviewNote || ""
          }
        },
        {
          session,
          returnDocument: "after"
        }
      );

      if (!withdrawal) {
        const existing = await Withdrawal.findById(withdrawalId)
          .session(session);

        if (!existing) {
          throw Object.assign(
            new Error("Withdrawal not found."),
            { statusCode: 404 }
          );
        }

        throw Object.assign(
          new Error("Only pending withdrawals can be moved to processing."),
          { statusCode: 409 }
        );
      }

      await AuditLog.create(
        [{
          actorId: adminId,
          action: "WITHDRAWAL_PROCESSING",
          targetUserId: withdrawal.userId,
          targetType: "WITHDRAWAL",
          referenceId: withdrawal._id.toString(),
          metadata: {
            reviewNote: reviewNote || ""
          },
          ipAddress
        }],
        { session }
      );

      result = withdrawal;
    });

    return result;
  } finally {
    await session.endSession();
  }
};


const cancelWithdrawal = async ({
  withdrawalId,
  userId,
  ipAddress
}) => {
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const existing = await Withdrawal.findOne({
        _id: withdrawalId,
        userId
      }).session(session);

      if (!existing) {
        throw Object.assign(
          new Error("Withdrawal not found."),
          { statusCode: 404 }
        );
      }

      if (existing.status !== "PENDING") {
        throw Object.assign(
          new Error("Only pending withdrawals can be cancelled."),
          { statusCode: 409 }
        );
      }

      const withdrawal = await Withdrawal.findOneAndUpdate(
        {
          _id: withdrawalId,
          userId,
          status: "PENDING"
        },
        {
          $set: {
            status: "CANCELLED",
            processedAt: new Date()
          }
        },
        {
          session,
          returnDocument: "after"
        }
      );

      if (!withdrawal) {
        throw Object.assign(
          new Error("Withdrawal status changed. Please refresh and try again."),
          { statusCode: 409 }
        );
      }

      // Refund the deducted VES.
      const wallet = await Wallet.findOneAndUpdate(
        { userId },
        {
          $inc: {
            ves: withdrawal.currencyAmount
          }
        },
        {
          session,
          returnDocument: "after",
          runValidators: true
        }
      );

      if (!wallet) {
        throw new Error("Wallet not found. Cancellation refund failed.");
      }

      const balanceAfter = wallet.ves;
      const balanceBefore = balanceAfter - withdrawal.currencyAmount;

      // Record the refund in the wallet ledger.
      await WalletTransaction.create(
        [{
          userId,
          currency: "VES",
          type: "CREDIT",
          amount: withdrawal.currencyAmount,
          balanceBefore,
          balanceAfter,
          source: "WITHDRAWAL_CANCEL_REFUND",
          referenceId: withdrawal._id.toString(),
          status: "SUCCESS",
          description: "Refund for cancelled withdrawal"
        }],
        { session }
      );

      // Record the cancellation in the audit log.
      await AuditLog.create(
        [{
          actorId: userId,
          action: "WITHDRAWAL_CANCELLED",
          targetUserId: userId,
          targetType: "WITHDRAWAL",
          referenceId: withdrawal._id.toString(),
          metadata: {
            refundedAmount: withdrawal.currencyAmount,
            currency: "VES"
          },
          ipAddress
        }],
        { session }
      );

      result = withdrawal;
    });

    return result;
  } finally {
    await session.endSession();
  }
};

module.exports = {
  createWithdrawal,
  approveWithdrawal,
  rejectWithdrawal,
  markWithdrawalProcessing,
  cancelWithdrawal
};
