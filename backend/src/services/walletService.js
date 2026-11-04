
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

const updateWallet = async ({
  userId,
  currency,
  amount,
  type,
  source,
  description,
  referenceId
}) => {
  const field = currencyFields[currency];

  if (!field) {
    throw new Error("Invalid currency.");
  }

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("Amount must be a positive integer.");
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
