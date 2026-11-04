const jwt = require("jsonwebtoken");

const protect = (req, res, next) => {
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user information to request
    req.user = decoded;

    next();

  } catch (error) {
    console.log("JWT Error:", error.name, error.message); 
    
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token."
    });
  }
};

module.exports = protect;