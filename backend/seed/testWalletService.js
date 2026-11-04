require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("../src/config/db");

const User = require("../src/models/user");
const Wallet = require("../src/models/Wallet");
const WalletTransaction = require("../src/models/WalletTransaction");

const {
  creditWallet,
  debitWallet
} = require("../src/services/walletService");

const testWalletService = async () => {
  try {
    await connectDB();

    const user = await User.findOne({
      email: "demo@veloop.test"
    });

    if (!user) {
      throw new Error("Demo user not found.");
    }

    // Test credit (run only once)
    const creditExists = await WalletTransaction.findOne({
      referenceId: "wallet-test-credit-1"
    });

    if (!creditExists) {
      await creditWallet({
        userId: user._id,
        currency: "VES",
        amount: 100,
        source: "SERVICE_TEST",
        referenceId: "wallet-test-credit-1",
        description: "Wallet service credit test"
      });

      console.log("Credit successful: +100 VEs");
    }

    // Test debit (run only once)
    const debitExists = await WalletTransaction.findOne({
      referenceId: "wallet-test-debit-1"
    });

    if (!debitExists) {
      await debitWallet({
        userId: user._id,
        currency: "VES",
        amount: 50,
        source: "SERVICE_TEST",
        referenceId: "wallet-test-debit-1",
        description: "Wallet service debit test"
      });

      console.log("Debit successful: -50 VEs");
    }

    const wallet = await Wallet.findOne({
      userId: user._id
    });

    const transactions = await WalletTransaction.find({
      userId: user._id,
      source: "SERVICE_TEST"
    });

    console.log("Current VEs:", wallet.ves);
    console.log("Test transactions:", transactions.length);

  } catch (error) {
    console.error("Test failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

testWalletService();