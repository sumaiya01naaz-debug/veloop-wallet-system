
require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const connectDB = require("../src/config/db");
const User = require("../src/models/User");
const Wallet = require("../src/models/wallet");

const seedDemo = async () => {
  try {
    if (!process.env.DEMO_USER_PASSWORD) {
      throw new Error("DEMO_USER_PASSWORD is missing from .env");
    }

    // Connect to MongoDB
    await connectDB();

    // Check whether demo user already exists
    let user = await User.findOne({
      email: "demo@veloop.test"
    });

    // Create demo user if it doesn't exist
    if (!user) {
      const passwordHash = await bcrypt.hash(
        process.env.DEMO_USER_PASSWORD,
        12
      );

      user = await User.create({
        name: "Demo User",
        email: "demo@veloop.test",
        passwordHash
      });

      console.log("Demo user created!");
    } else {
      console.log("Demo user already exists.");
    }

    // Check whether the user already has a wallet
    const existingWallet = await Wallet.findOne({
      userId: user._id
    });

    // Create wallet if it doesn't exist
    if (!existingWallet) {
      await Wallet.create({
        userId: user._id,
        ves: 25000,
        sves: 5000,
        gems: 100,
        tokens: 500,
        spins: 3
      });

      console.log("Demo wallet created!");
    } else {
      console.log("Demo wallet already exists.");
    }

    console.log("Demo data setup completed!");
  } catch (error) {
    console.error("Seeding failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

seedDemo();
