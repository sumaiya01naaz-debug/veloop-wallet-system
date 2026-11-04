const User = require("../models/user");

const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId)
      .select("role accountStatus");

    if (!user || user.accountStatus !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Active account required."
      });
    }

    if (user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Admin access required."
      });
    }

    next();

  } catch (error) {
    console.error("Admin authorization error:", error.message);

    res.status(500).json({
      success: false,
      message: "Authorization failed."
    });
  }
};

module.exports = requireAdmin;