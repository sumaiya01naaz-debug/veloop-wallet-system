const Withdrawal = require("../models/Withdrawal");
const mongoose = require("mongoose");
const {
  createWithdrawal,
  approveWithdrawal,
  rejectWithdrawal
} = require("../services/withdrawalService");

const submitWithdrawal = async (req, res) => {
  try {
    const { method, optionId, payoutDetails, idempotencyKey } = req.body;

    const withdrawal = await createWithdrawal({
      userId: req.user.userId,
      method,
      optionId,
      payoutDetails,
      idempotencyKey,
  ipAddress: req.ip
    });

    res.status(200).json({
      success: true,
      message: "Withdrawal request submitted successfully.",
      withdrawal
    });

  } catch (error) {
    console.error("Withdrawal error:", error.message);

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Unable to process withdrawal."
    });
  }
};

const getWithdrawals = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit) || 20, 1),
      100
    );

    const skip = (page - 1) * limit;

    const status = req.query.status?.toLowerCase();

    const statusMap = {
      pending: "PENDING",
      processing: "PROCESSING",
      paid: "APPROVED",
      rejected: "REJECTED",
      cancelled: "CANCELLED"
    };

    const filter = {
      userId: req.user.userId
    };

    if (status && status !== "all") {
      if (!statusMap[status]) {
        return res.status(400).json({
          success: false,
          message: "Invalid withdrawal status."
        });
      }

      filter.status = statusMap[status];
    }

    const [withdrawals, total] = await Promise.all([
      Withdrawal.find(filter)
        .select("-payoutDetails")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      Withdrawal.countDocuments(filter)
    ]);

    res.status(200).json({
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
    console.error("Withdrawal history error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to fetch withdrawals."
    });
  }
};

const getWithdrawalById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid withdrawal ID."
      });
    }

    const withdrawal = await Withdrawal.findOne({
      _id: id,
      userId: req.user.userId
    }).select("-payoutDetails");

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: "Withdrawal not found."
      });
    }

    res.status(200).json({
      success: true,
      withdrawal
    });

  } catch (error) {
    console.error("Withdrawal details error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to fetch withdrawal details."
    });
  }
};

const approveWithdrawalRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewNote } = req.body || {};

    // Validate withdrawal ID
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid withdrawal ID."
      });
    }

    // Validate optional review note
    if (
      reviewNote !== undefined &&
      (
        typeof reviewNote !== "string" ||
        reviewNote.trim().length > 500
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Review note must be a string of maximum 500 characters."
      });
    }

    const withdrawal = await approveWithdrawal({
      withdrawalId: id,
      adminId: req.user.userId,
      reviewNote: reviewNote?.trim() || ""
    });

    return res.status(200).json({
      success: true,
      message: "Withdrawal approved successfully.",
      withdrawal
    });

  } catch (error) {
    console.error("Withdrawal approval error:", error.message);

    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      success: false,
      message: statusCode < 500
        ? error.message
        : "Unable to approve withdrawal."
    });
  }
};

const rejectWithdrawalRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason, reviewNote } = req.body || {};

    // Validate withdrawal ID
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid withdrawal ID."
      });
    }

    // Validate rejection reason
    if (
      typeof rejectionReason !== "string" ||
      !rejectionReason.trim() ||
      rejectionReason.trim().length > 500
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid rejection reason is required (maximum 500 characters)."
      });
    }

    // Validate optional review note
    if (
      reviewNote !== undefined &&
      (
        typeof reviewNote !== "string" ||
        reviewNote.trim().length > 500
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Review note must be a string of maximum 500 characters."
      });
    }

    const withdrawal = await rejectWithdrawal({
      withdrawalId: id,
      adminId: req.user.userId,
      rejectionReason: rejectionReason.trim(),
      reviewNote: reviewNote?.trim() || ""
    });

    return res.status(200).json({
      success: true,
      message: "Withdrawal rejected and VEs refunded.",
      withdrawal
    });

  } catch (error) {
    console.error("Withdrawal rejection error:", error.message);

    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      success: false,
      message: statusCode < 500
        ? error.message
        : "Unable to reject withdrawal."
    });
  }
};

module.exports = {
  submitWithdrawal,
  getWithdrawals,
  getWithdrawalById,
  approveWithdrawalRequest,
  rejectWithdrawalRequest
};
