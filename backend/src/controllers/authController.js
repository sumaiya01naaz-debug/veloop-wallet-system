
const User = require("../models/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check whether email and password are provided
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required."
      });
    }

    // Find user in MongoDB
    const user = await User.findOne({
      email: email.toLowerCase().trim()
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    // Compare entered password with stored password hash
    const isPasswordValid = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    if (user.accountStatus !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Your account is not active."
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(200).json({
      success: true,
      message: "Login successful!",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error("Login error:", error.message);

    res.status(500).json({
      success: false,
      message: "Internal server error."
    });
  }
};

module.exports = { login };
