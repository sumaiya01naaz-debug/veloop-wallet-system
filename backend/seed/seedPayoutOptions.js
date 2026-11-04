
require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("../src/config/db");
const PayoutOption = require("../src/models/PayoutOption");

const payoutOptions = [
  { optionId: "upi_10", method: "upi", payoutAmount: 10, requiredAmount: 2400 },
  { optionId: "upi_50", method: "upi", payoutAmount: 50, requiredAmount: 10000 },
  { optionId: "upi_100", method: "upi", payoutAmount: 100, requiredAmount: 19500 },
  { optionId: "upi_500", method: "upi", payoutAmount: 500, requiredAmount: 80500 },
  { optionId: "upi_1000", method: "upi", payoutAmount: 1000, requiredAmount: 150000 }
];

const seedPayoutOptions = async () => {
  try {
    await connectDB();

    for (const option of payoutOptions) {
      await PayoutOption.updateOne(
        { optionId: option.optionId },
        {
          $set: {
            ...option,
            payoutCurrency: "INR",
            requiredCurrency: "VES",
            active: true
          }
        },
        { upsert: true, runValidators: true }
      );
    }

    console.log("UPI payout options seeded successfully!");

  } catch (error) {
    console.error("Seeding failed:", error.message);
    process.exitCode = 1;

  } finally {
    await mongoose.connection.close();
  }
};

seedPayoutOptions();
