
const mongoose = require("mongoose");

const User = require("../models/User");
const Wallet = require("../models/Wallet");
const Withdrawal = require("../models/Withdrawal");
const WalletTransaction = require("../models/WalletTransaction");
const AuditLog = require("../models/AuditLog");
const PayoutMethod = require("../models/PayoutMethod");
const getPagination = (query) => {
  const requestedPage = Number.parseInt(query.page, 10);
  const requestedLimit = Number.parseInt(query.limit, 10);

  const page =
    Number.isInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;

  const limit =
    Number.isInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 100)
      : 20;

  return {
    page,
    limit,
    skip: (page - 1) * limit
  };
};

// List users with optional name/email search
const getAdminUsers = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);

    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : "";

    if (search.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Search must not exceed 100 characters."
      });
    }

    const filter = {};

    if (search) {
      const escapedSearch = search.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      const searchRegex = new RegExp(escapedSearch, "i");

      filter.$or = [
        { name: searchRegex },
        { email: searchRegex }
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("name email role accountStatus createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      User.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error("Admin users error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch users."
    });
  }
};


// View a specific user's wallet
const getAdminUserWallet = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID."
      });
    }

    const [user, wallet] = await Promise.all([
      User.findById(userId)
        .select("name email role accountStatus")
        .lean(),

      Wallet.findOne({ userId })
        .select("ves sves gems tokens spins updatedAt")
        .lean()
    ]);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    return res.status(200).json({
      success: true,
      user,
      wallet
    });

  } catch (error) {
    console.error("Admin wallet lookup error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch user wallet."
    });
  }
};


// List all withdrawals with optional filters
const getAdminWithdrawals = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);

    const filter = {};
    const status = req.query.status?.toUpperCase();

    const allowedStatuses = [
      "PENDING",
      "PROCESSING",
      "APPROVED",
      "REJECTED",
      "CANCELLED"
    ];

    if (status && status !== "ALL") {
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid withdrawal status."
        });
      }

      filter.status = status;
    }

    if (req.query.userId) {
      if (!mongoose.isValidObjectId(req.query.userId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID."
        });
      }

      filter.userId = req.query.userId;
    }

    const [withdrawals, total] = await Promise.all([
      Withdrawal.find(filter)
        .select("-payoutDetails -idempotencyKey")
        .populate("userId", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Withdrawal.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      withdrawals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error("Admin withdrawals error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch withdrawals."
    });
  }
};


// View one withdrawal, including payout details for authorized admins
const getAdminWithdrawalById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid withdrawal ID."
      });
    }

    const withdrawal = await Withdrawal.findById(id)
      .select("-idempotencyKey")
      .populate("userId", "name email")
      .populate(
        "transactionId",
        "currency type amount balanceBefore balanceAfter status source createdAt"
      )
      .lean();

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: "Withdrawal not found."
      });
    }

    return res.status(200).json({
      success: true,
      withdrawal
    });

  } catch (error) {
    console.error("Admin withdrawal details error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch withdrawal details."
    });
  }
};


// Review wallet transactions across users
const getAdminTransactions = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);

    const filter = {};

    if (req.query.userId) {
      if (!mongoose.isValidObjectId(req.query.userId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID."
        });
      }

      filter.userId = req.query.userId;
    }

    const allowedCurrencies = [
      "VES",
      "SVES",
      "GEMS",
      "TOKENS",
      "SPINS"
    ];

    const allowedTypes = ["CREDIT", "DEBIT"];
    const allowedStatuses = ["SUCCESS", "PENDING", "FAILED"];

    if (req.query.currency) {
      const currency = req.query.currency.toUpperCase();

      if (!allowedCurrencies.includes(currency)) {
        return res.status(400).json({
          success: false,
          message: "Invalid transaction currency."
        });
      }

      filter.currency = currency;
    }

    if (req.query.type) {
      const type = req.query.type.toUpperCase();

      if (!allowedTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          message: "Invalid transaction type."
        });
      }

      filter.type = type;
    }

    if (req.query.status) {
      const status = req.query.status.toUpperCase();

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid transaction status."
        });
      }

      filter.status = status;
    }

    if (req.query.source) {
      if (
        typeof req.query.source !== "string" ||
        req.query.source.length > 100
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid transaction source."
        });
      }

      filter.source = req.query.source;
    }

    const [transactions, total] = await Promise.all([
      WalletTransaction.find(filter)
        .populate("userId", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      WalletTransaction.countDocuments(filter)
    ]);

    return res.status(200).json({
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
    console.error("Admin transactions error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch transactions."
    });
  }
};


// Review audit logs
const getAdminAuditLogs = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);

    const filter = {};

    const objectIdFilters = [
      "actorId",
      "targetUserId"
    ];

    for (const field of objectIdFilters) {
      if (req.query[field]) {
        if (!mongoose.isValidObjectId(req.query[field])) {
          return res.status(400).json({
            success: false,
            message: `Invalid ${field}.`
          });
        }

        filter[field] = req.query[field];
      }
    }

    if (req.query.action) {
      if (
        typeof req.query.action !== "string" ||
        req.query.action.length > 100
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid audit action."
        });
      }

      filter.action = req.query.action;
    }

    const allowedTargetTypes = [
  "USER",
  "WALLET",
  "WITHDRAWAL",
  "PAYOUT_OPTION",
  "PAYOUT_METHOD"
];

    if (req.query.targetType) {
      const targetType = req.query.targetType.toUpperCase();

      if (!allowedTargetTypes.includes(targetType)) {
        return res.status(400).json({
          success: false,
          message: "Invalid audit target type."
        });
      }

      filter.targetType = targetType;
    }

    if (req.query.referenceId) {
      if (
        typeof req.query.referenceId !== "string" ||
        req.query.referenceId.length > 128
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid reference ID."
        });
      }

      filter.referenceId = req.query.referenceId;
    }

    const [auditLogs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate("actorId", "name email")
        .populate("targetUserId", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      AuditLog.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      auditLogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error("Admin audit logs error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch audit logs."
    });
  }
};
// Read-only wallet and ledger reconciliation
const getAdminUserReconciliation = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID."
      });
    }

    const user = await User.findById(userId)
      .select("name email")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    const wallet = await Wallet.findOne({ userId }).lean();

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: "Wallet not found."
      });
    }

    const currencyFields = {
      VES: "ves",
      SVES: "sves",
      GEMS: "gems",
      TOKENS: "tokens",
      SPINS: "spins"
    };

    // Calculate ledger totals inside MongoDB.
    const ledgerSummary = await WalletTransaction.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          status: "SUCCESS",
          currency: {
            $in: Object.keys(currencyFields)
          }
        }
      },
      {
        $sort: {
          createdAt: 1,
          _id: 1
        }
      },
      {
        $group: {
          _id: "$currency",

          openingBalance: {
            $first: "$balanceBefore"
          },

          totalCredits: {
            $sum: {
              $cond: [
                { $eq: ["$type", "CREDIT"] },
                "$amount",
                0
              ]
            }
          },

          totalDebits: {
            $sum: {
              $cond: [
                { $eq: ["$type", "DEBIT"] },
                "$amount",
                0
              ]
            }
          },

          lastLedgerBalance: {
            $last: "$balanceAfter"
          },

          transactionCount: {
            $sum: 1
          }
        }
      }
    ]);

    const summaryMap = new Map(
      ledgerSummary.map(item => [item._id, item])
    );

    const currencies = Object.entries(currencyFields).map(
      ([currency, field]) => {
        const actualBalance = Number(wallet[field] || 0);
        const ledger = summaryMap.get(currency);

        // A currency without successful ledger entries
        // cannot be independently reconciled.
        if (!ledger) {
          return {
            currency,
            status: "NO_LEDGER_HISTORY",
            openingBalance: null,
            totalCredits: 0,
            totalDebits: 0,
            expectedBalance: null,
            lastLedgerBalance: null,
            actualWalletBalance: actualBalance,
            differenceFromWallet: null,
            transactionCount: 0
          };
        }

        const openingBalance = Number(ledger.openingBalance);
        const totalCredits = Number(ledger.totalCredits);
        const totalDebits = Number(ledger.totalDebits);

        const expectedBalance =
          openingBalance + totalCredits - totalDebits;

        const lastLedgerBalance =
          Number(ledger.lastLedgerBalance);

        const isReconciled =
          expectedBalance === actualBalance &&
          expectedBalance === lastLedgerBalance;

        return {
          currency,
          status: isReconciled
            ? "RECONCILED"
            : "DISCREPANCY",
          openingBalance,
          totalCredits,
          totalDebits,
          expectedBalance,
          lastLedgerBalance,
          actualWalletBalance: actualBalance,
          differenceFromWallet:
            actualBalance - expectedBalance,
          transactionCount: ledger.transactionCount
        };
      }
    );

    const reconciledCount = currencies.filter(
      item => item.status === "RECONCILED"
    ).length;

    const discrepancyCount = currencies.filter(
      item => item.status === "DISCREPANCY"
    ).length;

    const noHistoryCount = currencies.filter(
      item => item.status === "NO_LEDGER_HISTORY"
    ).length;

    return res.status(200).json({
      success: true,
      message: "Wallet reconciliation report generated.",
      report: {
        user,
        generatedAt: new Date(),
        readOnly: true,
        summary: {
          totalCurrencies: currencies.length,
          reconciledCount,
          discrepancyCount,
          noHistoryCount,
          fullyReconciled:
            discrepancyCount === 0 && noHistoryCount === 0
        },
        currencies
      }
    });

  } catch (error) {
    console.error("Wallet reconciliation error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to generate reconciliation report."
    });
  }
};
// Update payout method configuration with an audit record
const updateAdminPayoutMethod = async (req, res) => {
  const methodId =
    typeof req.params.methodId === "string"
      ? req.params.methodId.trim().toLowerCase()
      : "";

  if (!/^[a-z0-9_-]{2,50}$/.test(methodId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid payout method ID."
    });
  }

  const input = req.body || {};

  const allowedFields = [
    "active",
    "available",
    "unavailableReason",
    "badge",
    "displayOrder"
  ];

  const inputFields = Object.keys(input);

  if (
    inputFields.length === 0 ||
    inputFields.some(field => !allowedFields.includes(field))
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid or missing payout configuration fields."
    });
  }

  if (
    input.active !== undefined &&
    typeof input.active !== "boolean"
  ) {
    return res.status(400).json({
      success: false,
      message: "active must be a boolean."
    });
  }

  if (
    input.available !== undefined &&
    typeof input.available !== "boolean"
  ) {
    return res.status(400).json({
      success: false,
      message: "available must be a boolean."
    });
  }

  if (
    input.unavailableReason !== undefined &&
    input.unavailableReason !== null &&
    (
      typeof input.unavailableReason !== "string" ||
      input.unavailableReason.trim().length > 250
    )
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid unavailable reason."
    });
  }

  if (
    input.badge !== undefined &&
    input.badge !== null &&
    (
      typeof input.badge !== "string" ||
      input.badge.trim().length > 50
    )
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid payout badge."
    });
  }

  if (
    input.displayOrder !== undefined &&
    (
      !Number.isSafeInteger(input.displayOrder) ||
      input.displayOrder < 0 ||
      input.displayOrder > 9999
    )
  ) {
    return res.status(400).json({
      success: false,
      message: "displayOrder must be an integer between 0 and 9999."
    });
  }

  // Only UPI is currently configured by the withdrawal service.
  if (input.available === true && methodId !== "upi") {
    return res.status(400).json({
      success: false,
      message: "Only the UPI payout method is currently configured."
    });
  }

  if (input.active === false && input.available === true) {
    return res.status(400).json({
      success: false,
      message: "An inactive payout method cannot be available."
    });
  }

  const session = await mongoose.startSession();

  try {
    let updatedMethod;

    await session.withTransaction(async () => {
      const method = await PayoutMethod.findOne({
        methodId
      }).session(session);

      if (!method) {
        throw Object.assign(
          new Error("Payout method not found."),
          { statusCode: 404 }
        );
      }

      const before = {
        active: method.active,
        available: method.available,
        unavailableReason: method.unavailableReason || null,
        badge: method.badge || null,
        displayOrder: method.displayOrder
      };

      if (input.active !== undefined) {
        method.active = input.active;
      }

      if (input.available !== undefined) {
        method.available = input.available;
      }

      if (input.active === false) {
        method.available = false;
      }

      if (input.unavailableReason !== undefined) {
        method.unavailableReason =
          input.unavailableReason?.trim() || null;
      }

      if (input.badge !== undefined) {
        method.badge = input.badge?.trim() || null;
      }

      if (input.displayOrder !== undefined) {
        method.displayOrder = input.displayOrder;
      }

      if (method.available && !method.active) {
        throw Object.assign(
          new Error("An inactive payout method cannot be available."),
          { statusCode: 400 }
        );
      }

      if (method.available && method.methodId !== "upi") {
        throw Object.assign(
          new Error("Only the UPI payout method is currently configured."),
          { statusCode: 400 }
        );
      }

      if (method.available) {
        method.unavailableReason = null;
      } else if (!method.unavailableReason) {
        method.unavailableReason =
          "Temporarily unavailable by administrator.";
      }

      await method.save({ session });

      const after = {
        active: method.active,
        available: method.available,
        unavailableReason: method.unavailableReason || null,
        badge: method.badge || null,
        displayOrder: method.displayOrder
      };

      await AuditLog.create(
        [{
          actorId: req.user.userId,
          action: "PAYOUT_CONFIGURATION_CHANGED",
          targetType: "PAYOUT_METHOD",
          referenceId: method.methodId,
          metadata: {
            before,
            after
          },
          ipAddress: req.ip
        }],
        { session }
      );

      updatedMethod = method;
    });

    return res.status(200).json({
      success: true,
      message: "Payout configuration updated and audited.",
      method: updatedMethod
    });

  } catch (error) {
    console.error("Payout configuration error:", error.message);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Unable to update payout configuration."
    });

  } finally {
    await session.endSession();
  }
};
module.exports = {
  getAdminUsers,
  getAdminUserWallet,
  getAdminWithdrawals,
  getAdminWithdrawalById,
  getAdminTransactions,
  getAdminAuditLogs,
  getAdminUserReconciliation,
  updateAdminPayoutMethod
};