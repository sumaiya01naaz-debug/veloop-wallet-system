
const mongoose = require("mongoose");

const Wallet = require("../models/Wallet");
const WalletTransaction = require("../models/WalletTransaction");

const currencyFields = {
  VES: "ves",
  SVES: "sves",
  GEMS: "gems",
  TOKENS: "tokens",
  SPINS: "spins"
};
const AuditLog = require("../models/AuditLog");
const updateWallet = async ({
  userId,
  currency,
  amount,
  type,
  source,
  description,
  referenceId,
  actorId,
ipAddress
}) => {
  // Validate user ID
if (!mongoose.isValidObjectId(userId)) {
  throw Object.assign(
    new Error("Invalid user ID."),
    { statusCode: 400 }
  );
}

// Validate currency
if (
  typeof currency !== "string" ||
  !Object.prototype.hasOwnProperty.call(
    currencyFields,
    currency
  )
) {
  throw Object.assign(
    new Error("Invalid currency."),
    { statusCode: 400 }
  );
}

const field = currencyFields[currency];

// Validate transaction type
if (!["CREDIT", "DEBIT"].includes(type)) {
  throw Object.assign(
    new Error("Invalid transaction type."),
    { statusCode: 400 }
  );
}

// Validate amount
if (!Number.isSafeInteger(amount) || amount <= 0) {
  throw Object.assign(
    new Error("Amount must be a positive integer."),
    { statusCode: 400 }
  );
}

// Validate transaction source
if (
  typeof source !== "string" ||
  !source.trim() ||
  source.trim().length > 100
) {
  throw Object.assign(
    new Error("Valid transaction source is required."),
    { statusCode: 400 }
  );
}

// Validate description
if (
  typeof description !== "string" ||
  !description.trim() ||
  description.trim().length > 250
) {
  throw Object.assign(
    new Error("Valid transaction description is required."),
    { statusCode: 400 }
  );
}

// Validate optional reference ID
if (
  referenceId !== undefined &&
  referenceId !== null &&
  (
    typeof referenceId !== "string" ||
    referenceId.length > 150
  )
) {
  throw Object.assign(
    new Error("Invalid reference ID."),
    { statusCode: 400 }
  );
}

// Validate optional admin ID
if (
  actorId !== undefined &&
  !mongoose.isValidObjectId(actorId)
) {
  throw Object.assign(
    new Error("Invalid actor ID."),
    { statusCode: 400 }
  );
}

  const session = await mongoose.startSession();

  try {
    let transaction;

    await session.withTransaction(async () => {
      const filter = { userId };

      if (type === "DEBIT") {
        filter[field] = { $gte: amount };
      }

      const wallet = await Wallet.findOneAndUpdate(
        filter,
        {
          $inc: {
            [field]: type === "CREDIT" ? amount : -amount
          }
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
          throw new Error("Wallet not found.");
        }

        throw new Error(`Insufficient ${currency} balance.`);
      }

      const balanceAfter = wallet[field];

      const balanceBefore =
        type === "CREDIT"
          ? balanceAfter - amount
          : balanceAfter + amount;

      const [ledgerEntry] = await WalletTransaction.create(
        [{
          userId,
          currency,
          type,
          amount,
          balanceBefore,
          balanceAfter,
          source,
          referenceId,
          description,
          status: "SUCCESS"
        }],
        { session }
      );

      transaction = ledgerEntry;
      if (actorId) {
  await AuditLog.create(
    [{
      actorId,
      action: type === "CREDIT"
        ? "WALLET_CREDIT"
        : "WALLET_DEBIT",
      targetUserId: userId,
      targetType: "WALLET",
      referenceId: ledgerEntry._id.toString(),
      metadata: {
        currency,
        amount,
        source,
        balanceBefore,
        balanceAfter,
        description
      },
      ipAddress
    }],
    { session }
  );
}
    });

    return transaction;

  } finally {
    await session.endSession();
  }
};

const creditWallet = (data) =>
  updateWallet({ ...data, type: "CREDIT" });

const debitWallet = (data) =>
  updateWallet({ ...data, type: "DEBIT" });

module.exports = {
  creditWallet,
  debitWallet
};
