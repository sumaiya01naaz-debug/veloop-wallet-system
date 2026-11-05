
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
  idempotencyKey
}) => {
  // Check required fields
  if (!method || !optionId || !idempotencyKey) {
    throw Object.assign(
      new Error("Required withdrawal information is missing."),
      { statusCode: 400 }
    );
  }

  // For now, implement the verified UPI flow
  if (method !== "upi") {
    throw Object.assign(
      new Error("This payout method is not yet configured."),
      { statusCode: 400 }
    );
  }

  // Validate UPI ID
  const upiId = payoutDetails?.upiId?.trim();

  if (!upiId || !/^[\w.-]+@[A-Za-z0-9.-]+$/.test(upiId)) {
    throw Object.assign(
      new Error("Please provide a valid UPI ID."),
      { statusCode: 400 }
    );
  }

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
        throw new Error("Withdrawal not found.");
      }

      if (!["PENDING", "PROCESSING"].includes(withdrawal.status)) {
        throw new Error("Withdrawal has already been processed.");
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
        throw new Error("Withdrawal has already been processed.");
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
