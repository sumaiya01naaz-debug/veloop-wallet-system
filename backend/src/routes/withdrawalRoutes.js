const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/adminMiddleware");

const {
  withdrawalLimiter
} = require("../middleware/rateLimiters");

const {
  submitWithdrawal,
  getWithdrawals,
  getWithdrawalById,
  approveWithdrawalRequest,
  rejectWithdrawalRequest,
  processWithdrawalRequest,
  cancelWithdrawalRequest
} = require("../controllers/withdrawalController");

// User routes
router.post("/", protect, withdrawalLimiter, submitWithdrawal);
router.get("/", protect, getWithdrawals);
router.get("/:id", protect, getWithdrawalById);

// Admin routes
router.patch(
  "/:id/approve",
  protect,
  requireAdmin,
  approveWithdrawalRequest
);

router.patch(
  "/:id/reject",
  protect,
  requireAdmin,
  rejectWithdrawalRequest
);

// User cancellation: users can cancel only their own pending withdrawal.
router.patch(
  "/:id/cancel",
  protect,
  cancelWithdrawalRequest
);

// Admin review: move a pending withdrawal into processing.
router.patch(
  "/:id/process",
  protect,
  requireAdmin,
  processWithdrawalRequest
);

module.exports = router;