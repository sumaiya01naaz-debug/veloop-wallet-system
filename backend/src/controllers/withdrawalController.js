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
      idempotencyKey
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
    const withdrawal = await approveWithdrawal({
      withdrawalId: req.params.id,
      adminId: req.user.userId,
      reviewNote: req.body.reviewNote
    });

    res.status(200).json({
      success: true,
      message: "Withdrawal approved successfully.",
      withdrawal
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

const rejectWithdrawalRequest = async (req, res) => {
  try {
    const withdrawal = await rejectWithdrawal({
      withdrawalId: req.params.id,
      adminId: req.user.userId,
      rejectionReason: req.body.rejectionReason,
      reviewNote: req.body.reviewNote
    });

    res.status(200).json({
      success: true,
      message: "Withdrawal rejected and VEs refunded.",
      withdrawal
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
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
