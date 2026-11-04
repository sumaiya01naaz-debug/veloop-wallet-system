const Wallet = require("../models/Wallet");
const WalletTransaction = require("../models/WalletTransaction");

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

module.exports = { getWallet };

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

module.exports = {
  getWallet,
  getWalletTransactions
};