
const { rateLimit } = require("express-rate-limit");

// Login: 10 attempts per IP per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-6",
  legacyHeaders: false,
  skipFailedRequests: false,
  statusCode: 429,
  message: {
    success: false,
    message: "Too many login attempts. Please try again later."
  }
});

// Withdrawals: 5 requests per authenticated user per minute
const withdrawalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  keyGenerator: (req) => req.user.userId,
  standardHeaders: "draft-6",
  legacyHeaders: false,
  skipFailedRequests: false,
  statusCode: 429,
  message: {
    success: false,
    message: "Too many withdrawal requests. Please try again later."
  }
});

// Admin wallet modifications: 10 requests per admin per minute
const walletMutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  keyGenerator: (req) => req.user.userId,
  standardHeaders: "draft-6",
  legacyHeaders: false,
  skipFailedRequests: false,
  statusCode: 429,
  message: {
    success: false,
    message: "Too many wallet modification requests. Please try again later."
  }
});

module.exports = {
  authLimiter,
  withdrawalLimiter,
  walletMutationLimiter
};
