
require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("../src/config/db");
const User = require("../src/models/User");
const WalletTransaction = require("../src/models/WalletTransaction");

const seedTransactions = async () => {
  try {
    await connectDB();

    const user = await User.findOne({
      email: "demo@veloop.test"
    });

    if (!user) {
      throw new Error("Demo user not found");
    }

    const existingCount = await WalletTransaction.countDocuments({
      userId: user._id
    });

    if (existingCount > 0) {
      console.log("Demo transactions already exist.");
      return;
    }

    await WalletTransaction.insertMany([
      {
        userId: user._id,
        currency: "VES",
        type: "CREDIT",
        amount: 10000,
        balanceBefore: 0,
        balanceAfter: 10000,
        source: "AD_REWARD",
        description: "Demo Ad Reward"
      },
      {
        userId: user._id,
        currency: "VES",
        type: "CREDIT",
        amount: 10000,
        balanceBefore: 10000,
        balanceAfter: 20000,
        source: "DAILY_REWARD",
        description: "Demo Daily Reward"
      },
      {
        userId: user._id,
        currency: "VES",
        type: "CREDIT",
        amount: 5000,
        balanceBefore: 20000,
        balanceAfter: 25000,
        source: "REFERRAL",
        description: "Demo Referral Reward"
      }
    ]);

    console.log("Demo transactions created!");

  } catch (error) {
    console.error("Seed failed:", error.message);
    process.exitCode = 1;

  } finally {
    await mongoose.connection.close();
  }
};

seedTransactions();
