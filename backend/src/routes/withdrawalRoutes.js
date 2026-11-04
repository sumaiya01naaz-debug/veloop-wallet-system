const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");

const {
  submitWithdrawal,
  getWithdrawals,
  getWithdrawalById
} = require("../controllers/withdrawalController");

const requireAdmin = require("../middleware/adminMiddleware");

const {
  approveWithdrawalRequest,
  rejectWithdrawalRequest
} = require("../controllers/withdrawalController");

router.post("/", protect, submitWithdrawal);
router.get("/", protect, getWithdrawals);

router.get("/:id", protect, getWithdrawalById);
// Admin approval
router.patch(
  "/:id/approve",
  protect,
  requireAdmin,
  approveWithdrawalRequest
);

// Admin rejection
router.patch(
  "/:id/reject",
  protect,
  requireAdmin,
  rejectWithdrawalRequest
);

module.exports = router;