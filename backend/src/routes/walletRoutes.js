const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/adminMiddleware");

const {
  walletMutationLimiter
} = require("../middleware/rateLimiters");

const {
  getWallet,
  getWalletTransactions,
  getWalletSummary
} = require("../controllers/walletController");

const {
  adminCreditWallet,
  adminDebitWallet
} = require("../controllers/walletAdminController");

// Get wallet balance
router.get("/", protect, getWallet);

// Get wallet transaction history
router.get("/transactions", protect, getWalletTransactions);

// Get wallet summary
router.get("/summary", protect, getWalletSummary);

// Admin-only wallet adjustments with rate limiting
router.post(
  "/credit",
  protect,
  walletMutationLimiter,
  requireAdmin,
  adminCreditWallet
);

router.post(
  "/debit",
  protect,
  walletMutationLimiter,
  requireAdmin,
  adminDebitWallet
);

module.exports = router;