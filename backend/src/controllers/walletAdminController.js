const mongoose = require("mongoose");
const User = require("../models/User");

const {
  creditWallet,
  debitWallet
} = require("../services/walletService");

const allowedCurrencies = [
  "VES",
  "SVES",
  "GEMS",
  "TOKENS",
  "SPINS"
];

const adjustWallet = (type, sourceOverride = null) => async (req, res) => {
  try {
    const {
      userId,
      currency,
      amount,
      description,
      referenceId
    } = req.body;

    // Validate target user ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Valid userId is required."
      });
    }

    // Validate currency
    if (!allowedCurrencies.includes(currency)) {
      return res.status(400).json({
        success: false,
        message: "Invalid currency."
      });
    }

    // Validate amount
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be a positive integer."
      });
    }

    // Validate description
    if (
      typeof description !== "string" ||
      !description.trim() ||
      description.trim().length > 250
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid description is required."
      });
    }

    // Check target user
    const targetUser = await User.findById(userId)
      .select("accountStatus");

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    if (targetUser.accountStatus !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Target user account is not active."
      });
    }

    const adjustmentData = {
      userId: targetUser._id,
      currency,
      amount,
      source: sourceOverride || (
  type === "CREDIT"
    ? "ADMIN_CREDIT"
    : "ADMIN_DEBIT"
),
      description: description.trim(),
      referenceId,
      actorId: req.user.userId,
      ipAddress: req.ip
    };

    const transaction = type === "CREDIT"
      ? await creditWallet(adjustmentData)
      : await debitWallet(adjustmentData);

    return res.status(200).json({
      success: true,
      message: sourceOverride
  ? "Wallet balance correction successful."
  : `Wallet ${type.toLowerCase()} successful.`,
      transaction
    });
} catch (error) {
  console.error("Admin wallet adjustment:", error.message);

  const statusCode = error.statusCode ||
    (
      error.message === "Wallet not found." ||
      error.message.startsWith("Insufficient ")
        ? 400
        : 500
    );

  return res.status(statusCode).json({
    success: false,
    message: statusCode < 500
      ? error.message
      : "Unable to update wallet."
  });
}
};
const adminCorrectWallet = async (req, res) => {
  const direction =
    typeof req.body?.direction === "string"
      ? req.body.direction.toUpperCase()
      : "";

  if (!["CREDIT", "DEBIT"].includes(direction)) {
    return res.status(400).json({
      success: false,
      message: "Direction must be CREDIT or DEBIT."
    });
  }

  return adjustWallet(
    direction,
    "BALANCE_CORRECTION"
  )(req, res);
};
const adminCreditWallet = adjustWallet("CREDIT");
const adminDebitWallet = adjustWallet("DEBIT");

module.exports = {
  adminCreditWallet,
  adminDebitWallet,
  adminCorrectWallet
};