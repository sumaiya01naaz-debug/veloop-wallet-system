
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Check whether token exists
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }

    // Extract token
    const token = authHeader.split(" ")[1];

    // Verify token
    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token."
      });
    }

    // Find the user in MongoDB
    const user = await User.findById(decoded.userId)
      .select("role accountStatus");

    // Check whether user exists
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User account not found."
      });
    }

    // Check account status
    if (user.accountStatus !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Your account is suspended or inactive."
      });
    }

    // Attach current database information
    req.user = {
      ...decoded,
      userId: user._id.toString(),
      role: user.role
    };

    next();

  } catch (error) {
    console.error("Authentication middleware error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Authentication service unavailable."
    });
  }
};

module.exports = protect;
