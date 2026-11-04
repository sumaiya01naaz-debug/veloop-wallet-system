const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");

const {
  getWallet,
  getWalletTransactions
} = require("../controllers/walletController");

// Get wallet balance
router.get("/", protect, getWallet);

// Get wallet transaction history
router.get("/transactions", protect, getWalletTransactions);

module.exports = router;