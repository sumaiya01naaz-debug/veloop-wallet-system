const Wallet = require("../models/Wallet");
const WalletTransaction = require("../models/WalletTransaction");
const mongoose = require("mongoose");
const Withdrawal = require("../models/Withdrawal");

const getWallet = async (req, res) => {
  try {
    // Find wallet belonging to logged-in user
    const wallet = await Wallet.findOne({
      userId: req.user.userId
    });

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: "Wallet not found."
      });
    }

    res.status(200).json({
      success: true,
      wallet: {
        ves: wallet.ves
      }
    });

  } catch (error) {
    console.error("Get wallet error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to fetch wallet."
    });
  }
};


const getWalletTransactions = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);

    const limit = Math.min(
      Math.max(parseInt(req.query.limit) || 20, 1),
      100
    );

    const skip = (page - 1) * limit;

    const filter = {
      userId: req.user.userId
    };

    const [transactions, total] = await Promise.all([
      WalletTransaction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      WalletTransaction.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error("Transaction history error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to fetch transactions."
    });
  }
};
const getWalletSummary = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.userId);

    const [wallet, withdrawalSummary, pendingWithdrawals] =
      await Promise.all([
        Wallet.findOne({ userId })
          .select("ves updatedAt")
          .lean(),

        Withdrawal.aggregate([
          {
            $match: {
              userId,
              status: "APPROVED"
            }
          },
          {
            $group: {
              _id: null,
              totalVes: { $sum: "$currencyAmount" },
              totalPayout: { $sum: "$payoutAmount" }
            }
          }
        ]),

        Withdrawal.countDocuments({
          userId,
          status: { $in: ["PENDING", "PROCESSING"] }
        })
      ]);

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: "Wallet not found."
      });
    }

    const totals = withdrawalSummary[0] || {
      totalVes: 0,
      totalPayout: 0
    };

    return res.status(200).json({
      success: true,
      summary: {
        availableVes: wallet.ves,
        totalWithdrawnVes: totals.totalVes,
        totalWithdrawnRupees: totals.totalPayout,
        pendingWithdrawals,
        updatedAt: wallet.updatedAt
      }
    });

  } catch (error) {
    console.error("Wallet summary error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch wallet summary."
    });
  }
};
module.exports = {
  getWallet,
  getWalletTransactions,
  getWalletSummary
};