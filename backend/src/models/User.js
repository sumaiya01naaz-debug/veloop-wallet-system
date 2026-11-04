const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    passwordHash: {
      type: String,
      required: true
    },

    accountStatus: {
      type: String,
      enum: ["ACTIVE", "SUSPENDED"],
      default: "ACTIVE"
    },

    role: {
      type: String,
      enum: ["USER", "ADMIN"],
      default: "USER"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);