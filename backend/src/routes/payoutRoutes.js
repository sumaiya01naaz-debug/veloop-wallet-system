const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");

const {
  getPayoutMethods,
  getPayoutOptions
} = require("../controllers/payoutController");

router.get("/methods", protect, getPayoutMethods);

router.get("/options/:method", protect, getPayoutOptions);

module.exports = router;