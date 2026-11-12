
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
          status: "PENDING",
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


module.exports = {
  createWithdrawal,
  approveWithdrawal,
  rejectWithdrawal
};
