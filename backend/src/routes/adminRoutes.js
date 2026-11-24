
const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/adminMiddleware");

const {
  getAdminUsers,
  getAdminUserWallet,
  getAdminWithdrawals,
  getAdminWithdrawalById,
  getAdminTransactions,
  getAdminAuditLogs
} = require("../controllers/adminController");

const {
  getAdminUserReconciliation,
  updateAdminPayoutMethod
} = require("../controllers/adminController");

const {
  adminCorrectWallet
} = require("../controllers/walletAdminController");
// All routes below require authentication and ADMIN role
router.use(protect, requireAdmin);

// User search and wallet lookup
router.get("/users", getAdminUsers);
router.get("/users/:userId/wallet", getAdminUserWallet);

// Withdrawal review
router.get("/withdrawals", getAdminWithdrawals);
router.get("/withdrawals/:id", getAdminWithdrawalById);

// Transaction and audit review
router.get("/transactions", getAdminTransactions);
router.get("/audit-logs", getAdminAuditLogs);

// Read-only wallet reconciliation
router.get(
  "/users/:userId/reconciliation",
  getAdminUserReconciliation
);

// Explicit balance correction with dedicated audit event
router.post(
  "/wallet/correct",
  adminCorrectWallet
);

// Audited payout method configuration
router.patch(
  "/payout-methods/:methodId",
  updateAdminPayoutMethod
);

module.exports = router;
